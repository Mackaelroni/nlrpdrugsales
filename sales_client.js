const Wait = (ms) => new Promise(res => setTimeout(res, ms));

let DRUG_SALE_HISTORY = [];

let cancel_animation_sequence_player = false;
let cancel_animation_sequence_ped = false;

setInterval(() => {
    if (DRUG_SALE_HISTORY.length >= 1) {
        const TempHistory = [];

        for (let i = 0; i < DRUG_SALE_HISTORY.length; i++) {
            const time_elapsed = GetGameTimer() - DRUG_SALE_HISTORY[i].timestamp;

            if (time_elapsed < 900000) { // 15 minutes
                TempHistory.push(DRUG_SALE_HISTORY[i]);
            }
        }

        DRUG_SALE_HISTORY = TempHistory;
    }
}, 60000);

function notify(message) {
	SetNotificationTextEntry("STRING");
	AddTextComponentString(message);
	DrawNotification(true, false);
    return;
}

function Time() { // The timer provided by the game engine in milliseconds.
    return GetGameTimer();
}

function isDurationComplete(timestamp, duration) { // Can also be used on UI items that need time-on-screen tracked and handled automatically.
    const time_difference = GetGameTimer() - timestamp; // The current moment minus our reference time.

    if (time_difference >= duration) {
        return true;
    } else {
        return false;
    }
}

async function loadAnimationsToRam(anim_dict) { // NO LONGER USE THIS BY ITSELF! Use utilEnsureAllAnimationsLoaded instead!
    let AnimationsLoaded = true;
    let start = Time();
    RequestAnimDict(anim_dict);

    while (!HasAnimDictLoaded(anim_dict)) {
        if (isDurationComplete(start, 2000)) {
            AnimationsLoaded = false;
            break;
        }

        await Wait(0);
    }

    return AnimationsLoaded;
}

async function utilEnsureAllAnimationsLoaded(anim_list) {
    return new Promise(async (resolve, reject) => {
        let num_unique_anim_dicts = 0;
        const ValidAnimDicts = [];
        const InvalidAnimDicts = [];

        for (let i = 0; i < anim_list.length; i++) {
            if (DoesAnimDictExist(anim_list[i]) && await loadAnimationsToRam(anim_list[i])) {
                num_unique_anim_dicts++;
                ValidAnimDicts.push(anim_list[i]);
            } else {
                InvalidAnimDicts.push(anim_list[i]);
            }
        }

        if (ValidAnimDicts.length === num_unique_anim_dicts) {
            resolve(true);
        } else {
            reject(false);
        }
    });
}

// This factory function is used to cut down on repetitive typing of object fields when putting together animation sequences with detailed instructions.
function Animation(dict, name, duration, flag, player_wait_cancel, cont_if_cancelled, ped_wait_for) {
    this.anim_dict = dict;
    this.anim_name = name;
    this.duration = duration;
    this.flag = flag;
    this.player_wait_cancel = player_wait_cancel;
    this.cont_if_cancelled = cont_if_cancelled;
    this.ped_wait_for = ped_wait_for;
    return this;
}

async function PlayAnimationSequence(ped, sequence) {
    if (DoesEntityExist(ped) && sequence.length > 0) {
        // First, load all of the required animations for this sequence.
        const AnimDicts = [];

        let total_seq_actions = sequence.length;
        let current_anim_index;
        let current_sequence_stage = 0;

        let force_cancel_sequence = false;

        for (let z = 0; z < sequence.length; z++) {
            if (AnimDicts.indexOf(sequence[z].anim_dict) === -1) {
                AnimDicts.push(sequence[z].anim_dict);
            }
        }

        if (await utilEnsureAllAnimationsLoaded(AnimDicts)) {
            // Go through the sequence of animations provided in the exact order provided no matter the dictionary because they have all been pre-loaded to RAM.
            for (let i = 0; i < sequence.length; i++) {
                // Allows for hotkeys besides spacebar to cancel a sequence (such as body dragging) on a player or ped at any point.
                if (cancel_animation_sequence_player && ped === PlayerPedId()) {
                    cancel_animation_sequence_player = false;
                    break;
                } else if (cancel_animation_sequence_ped) {
                    cancel_animation_sequence_ped = false;
                    break;
                }

                current_anim_index = i;
                current_sequence_stage++;

                const AnimDuration = Math.floor(GetAnimDuration(sequence[i].anim_dict, sequence[i].anim_name) * 1000);

                if (sequence[i].duration === null) {
                    TaskPlayAnim(ped, sequence[i].anim_dict, sequence[i].anim_name, 8.0, 8.0, AnimDuration, sequence[i].flag, 0.0, false, false, false);
                } else {
                    TaskPlayAnim(ped, sequence[i].anim_dict, sequence[i].anim_name, 8.0, 8.0, sequence[i].duration, sequence[i].flag, 0.0, false, false, false);
                }

                if (sequence[i].player_wait_cancel) {
                    /* This code path is intended for animations played on PLAYERS. If an animation has been marked 'player_wait_cancel' that means that the player needs to
                    press a specific hotkey to cancel the animation. If the value 'cont_if_cancelled' is true, then the animation sequence should continue once the player has
                    pressed the hotkey, otherwise, cancel the rest of the sequence.*/
                    let cancel_wait_start = 0;

                    while (!force_cancel_sequence) {
                        await Wait(0);

                        // Disable the spacebar while in any animation sequence and use it to cancel animations cleanly.
                        DisableControlAction(0, 22, true);

                        if (IsDisabledControlJustReleased(0, 22)) {
                            if (sequence[i].cont_if_cancelled) {
                                // The sequence should continue from this stage to the next.
                                break;
                            } else {
                                // Nothing left to do here because the sequence needs to be cut short.
                                ClearPedTasks(ped);
                                return;
                            }
                        }

                        /* If the duration selected for the animation is not -1 (defer to flag -> infinite looping via flag), then utilize the base anim length.
                        */
                        if (sequence[i].duration === -1) {
                            // Infinite loop this animation until the player cancels it.
                        } else if (sequence[i].duration > 0) {
                            // Use the custom duration entered for the animation to provide cancellability throughout the animation.
                            if (isDurationComplete(cancel_wait_start, sequence[i].duration)) {
                                break;
                            }
                        } else {
                            // Use the base duration of the animation to provide cancellability throughout the animation.
                            if (isDurationComplete(cancel_wait_start, AnimDuration)) {
                                break;
                            }
                        }
                    }

                } else if (sequence[i].ped_wait_for !== null && sequence[i].ped_wait_for.length > 0) {
                    /* This code path is intended for animations played on AI. If an animation has been marked 'ped_wait_for' that means the ped is waiting for
                    some specific action or condition to take place in the game world before moving on to the next animation or next action (such as being aimed at,
                    or having a specific ped/vehicle show up, etc.).*/
                } else {
                    // This code path is UNIVERSAL and can be used on PLAYERS & AI. The animation either plays for its base duration, or a custom duration loop.
                    if (sequence[i].duration) {
                        // Wait for the custom duration entered by the developer in a loop with a 100ms blend buffer between this animation and the next one in the sequence.
                        // The actual looping of the animation should come from setting the proper flag on that animation.
                        await Wait(sequence[i].duration - 100);
                    } else {
                        // Wait for the base duration of the animation as it was created originally.
                        while (Number(GetEntityAnimCurrentTime(ped, sequence[i].anim_dict, sequence[i].anim_name).toFixed(1)) !== 1.0) {
                            await Wait(0);
                        }
                    }
                }
            }

            return true;
        } else {
            // An invalid anim_dict was provided. The entire sequence must fail here.
            console.log('INVALID ANIMATION DICTIONARY PASSED TO: PlayAnimationSequence()');
            return false;
        }
    } else {
        // Either the entity targeted for this sequence doesn't exist or there was no sequence of animations provided.
        return false;
    }
}

function getPedCoordinates(ped) { // Returns the coordinates of a separate entity from the player.
    const coordinates = GetEntityCoords(ped);
    const direction = GetEntityHeading(ped);
    const coord_data = {x: coordinates[0], y: coordinates[1], z: coordinates[2], h: direction};
    return coord_data;
}

function getDistanceBetweenPoints(location_one, location_two) {
    const delta_x = location_one.x - location_two.x;
    const delta_y = location_one.y - location_two.y;
    const delta_z = location_one.z - location_two.z;
    const distance = Math.sqrt((delta_x * delta_x) + (delta_y * delta_y) + (delta_z * delta_z));
    return distance;
}

async function AnimateCallingCops(npc) {
    /*NetworkRequestControlOfEntity(npc);

    while (!NetworkHasControlOfEntity(npc)) {
        await Wait(0);
    }*/

    ClearPedTasksImmediately(npc);

    const coords = getPedCoordinates(npc);
    const phone = CreateObject(GetHashKey("prop_npc_phone"), coords.x, coords.y, coords.z, true, true, true);
    const target_bone = GetPedBoneIndex(npc, 28422);

    AttachEntityToEntity(phone, npc, target_bone, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true);

    const SequenceComplete = await PlayAnimationSequence(npc, [
        new Animation('amb@world_human_stand_mobile@male@standing@call@enter', 'enter', null, 0, false, false, null),
        new Animation('amb@world_human_stand_mobile@male@standing@call@idle_a', 'idle_a', null, 0, false, false, null),
        new Animation('amb@world_human_stand_mobile@male@standing@call@idle_a', 'idle_b', null, 0, false, false, null),
        new Animation('amb@world_human_stand_mobile@male@standing@call@exit', 'exit', null, 0, false, false, null)
    ]);

    if (SequenceComplete) {
        DeleteObject(phone);
        TaskWanderStandard(npc, 10.0, 10.0);
    }

    /*RequestAnimDict('amb@world_human_stand_mobile@male@standing@call@base');

    while (!HasAnimDictLoaded('amb@world_human_stand_mobile@male@standing@call@base')) {
        await Wait(0);
    }

    // Create the phone object and attach it to the NPC, then animate for 10 seconds.
    const coords = getPedCoordinates(npc);
    const phone = CreateObject(GetHashKey("prop_npc_phone"), coords.x, coords.y, coords.z, true, true, true);
    const target_bone = GetPedBoneIndex(npc, 28422);
    AttachEntityToEntity(phone, npc, target_bone, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, true, true, false, true, 1, true);
    TaskPlayAnim(npc, "amb@world_human_stand_mobile@male@standing@call@base", "base", 8.0, 8.0, 7000, 3, 1.0, false, false, false);
    await Wait(7000);
    DeleteObject(phone);
    TaskWanderStandard(npc, 10.0, 10.0);*/
    return;
}

function IsValidSaleTarget(npc) {
    if (DRUG_SALE_HISTORY.length >= 1) {
        let target_valid = true;
        let invalid_type = null;

        for (let i = 0; i < DRUG_SALE_HISTORY.length; i++) {
            if (DRUG_SALE_HISTORY[i].id === npc) {
                target_valid = false;
                invalid_type = DRUG_SALE_HISTORY[i].type;
                break;
            }
        }

        if (target_valid) {
            return true;
        } else {
            if (invalid_type === 'ALREADY_SOLD') {
                emit("mythic_notify:client:SendAlert", {
                    type: 'error',
                    text: 'I don\'t want anymore!',
                    length: 5000,
                });
            } else {
                const call_cops_roll = GetRandomIntInRange(1, 100);

                if (call_cops_roll <= 40) {
                    TriggerEvent("NLRP:REPORT_DRUG_DEALER_TO_POLICE");
                    emit("mythic_notify:client:SendAlert", {
                        type: 'error',
                        text: 'I\'m calling the cops!',
                        length: 5000,
                    });
                    AnimateCallingCops(npc);
                } else {
                    emit("mythic_notify:client:SendAlert", {
                        type: 'inform',
                        text: 'Product refused. Don\'t push your luck',
                        length: 5000,
                    });
                }
            }

            return false;
        }
    } else {
        // The list is empty, so the NPC being targeted
        return true;
    }
}

let actively_selling_drugs = false;
let started_sale = false;
let sale_started_timestamp = null;
let sale_cancelled = false;
let negotiation_duration = 4500; // In milliseconds
let buyer = null;
let selling_cooldown_timestamp = GetGameTimer();

async function SellDrugsToNPC(player, npc_buyer) {

    function ResetDrugSaleVariables() {
        ClearPedTasks(player);
        ClearPedTasks(npc_buyer);
        actively_selling_drugs = false;
        started_sale = false;
        sale_started_timestamp = null;
        sale_cancelled = false;
        buyer = null;
    }

    function AddPedToDrugSaleHistory(npc, type) { // Type Options: 'ALREADY_SOLD', 'REJECTED_OFFER'
        DRUG_SALE_HISTORY.push({id: npc, type: type, timestamp: GetGameTimer()});
    }

    let negotiating = true;

    SetEntityAsMissionEntity(npc_buyer);
    TaskStartScenarioInPlace(player, "WORLD_HUMAN_DRUG_DEALER_HARD", 0.0, true);

    while (negotiating) { // If the player spots police or some other type of problem, allow them time to cancel the transaction. ADD DISTANCE CHECK!
        SetCanPedEquipAllWeapons(player, false);
        await Wait(25);

        const player_pos = getPedCoordinates(player);
        const buyer_pos = getPedCoordinates(npc_buyer);

        if (!sale_cancelled) {
            if (getDistanceBetweenPoints(player_pos, buyer_pos) <= 3) {
                if (!IsPedDeadOrDying(npc_buyer)) { // If the NPC dies during the sale, cancel it automatically.
                    if (isDurationComplete(sale_started_timestamp, negotiation_duration)) {
                        SetCanPedEquipAllWeapons(player, true);
                        negotiating = false;
                    }
                } else {
                    sale_cancelled = true;
                    negotiating = false;
                    SetCanPedEquipAllWeapons(player, true);
                    emit("mythic_notify:client:SendAlert", {
                        type: 'inform',
                        text: 'The buyer was killed!',
                        length: 5000,
                    });
                }
            } else {
                // Too far away from the buyer, cancel the sale.
                sale_cancelled = true;
                negotiating = false;
                SetCanPedEquipAllWeapons(player, true);
                emit("mythic_notify:client:SendAlert", {
                    type: 'inform',
                    text: 'Too far away from the buyer.',
                    length: 5000,
                });
            }
        } else {
            // Backspace key was pressed.
            SetCanPedEquipAllWeapons(player, true);
            negotiating = false;
        }
    }

    // Clear the current animation from player and buyer to prepare for the hand-off animations
    ClearPedTasksImmediately(player);
    ClearPedTasksImmediately(npc_buyer);

    if (!sale_cancelled) {
        RequestAnimDict('amb@prop_human_atm@male@enter');

        while (!HasAnimDictLoaded('amb@prop_human_atm@male@enter')) {
            await Wait(0);
        }

        // Determine here if the sale was successful or rejected.
        const buy_or_reject = GetRandomIntInRange(1, 100);
        const call_cops_roll = GetRandomIntInRange(1, 100);

        if (buy_or_reject <= 55) {
            // The sale was ACCEPTED.
            TriggerServerEvent("NLRP:SELL_DRUGS_TO_BUYER");

            const player_coords = getPedCoordinates(player);
            const buyer_coords = getPedCoordinates(npc_buyer);
            const player_right_hand = GetPedBoneIndex(player, 57005);
            const buyer_right_hand = GetPedBoneIndex(npc_buyer, 57005);

            // Spawn a drug package object in the player's right hand and play an animation representing a hand off.
            const drug_package = CreateObject(GetHashKey("prop_drug_package_02"), player_coords.x, player_coords.y, player_coords.z, true, true, true);
            const buyer_cash = CreateObject(GetHashKey("prop_cash_pile_01"), buyer_coords.x, buyer_coords.y, buyer_coords.z, true, true, true);

            // At first the drugs are attached to the player, and the cash is attached to the buyer.
            AttachEntityToEntity(drug_package, player, player_right_hand, 0.225, 0.0, -0.05, 0.0, 0.0, 0.0, true, true, false, true, 1, true);
            AttachEntityToEntity(buyer_cash, npc_buyer, buyer_right_hand, 0.185, 0.0, -0.05, 0.0, 0.0, 0.0, true, true, false, true, 1, true);

            // Trigger the hand off animation scenario on both player and buyer.
            TaskStartScenarioInPlace(player, "PROP_HUMAN_ATM", 0.0, true);
            TaskPlayAnim(npc_buyer, "amb@prop_human_atm@male@enter", "enter", 8.0, 8.0, 1750, 3, 0.0, false, false, false);

            // Wait for 1.5 seconds, then swap the objects between player and buyer.
            await Wait(1500);

            // The hand-off is nearly complete.
            AttachEntityToEntity(drug_package, npc_buyer, buyer_right_hand, 0.225, 0.0, -0.05, 0.0, 0.0, 0.0, true, true, false, true, 1, true);
            AttachEntityToEntity(buyer_cash, player, player_right_hand, 0.185, 0.0, -0.05, 0.0, 0.0, 0.0, true, true, false, true, 1, true);

            // Wait for 1.750 seconds, delete the objects and end the animation scenario for both entities.
            await Wait(1750);

            DeleteObject(drug_package);
            DeleteObject(buyer_cash);

            ClearPedTasksImmediately(player);
            ClearPedTasksImmediately(npc_buyer);

            AddPedToDrugSaleHistory(npc_buyer, 'ALREADY_SOLD');

            actively_selling_drugs = false;
            started_sale = false;
            sale_started_timestamp = null;
            sale_cancelled = false;
            buyer = null;

            TaskWanderStandard(npc_buyer, 10.0, 10.0);

            setTimeout(() => {
                SetEntityAsNoLongerNeeded(npc_buyer);
            }, 35000);
        } else {
            // The sale was REJECTED.
            emit("mythic_notify:client:SendAlert", {
                type: 'error',
                text: 'Your offer was rejected.',
                length: 5000,
            });
            ResetDrugSaleVariables();
            AddPedToDrugSaleHistory(npc_buyer, 'REJECTED');
            TaskWanderStandard(npc_buyer, 10.0, 10.0);

            setTimeout(() => {
                SetEntityAsNoLongerNeeded(npc_buyer);
            }, 35000);

            //Determine if this NPC is going to call the cops on the player.
            if (call_cops_roll <= 15) {
                TriggerEvent("NLRP:REPORT_DRUG_DEALER_TO_POLICE");
                await Wait(GetRandomIntInRange(5000, 9000));
                await AnimateCallingCops(npc_buyer);
            }
        }
    } else {
        // The sale was cancelled. Reset all the associated variables.
        emit("mythic_notify:client:SendAlert", {
            type: 'error',
            text: 'Sale cancelled!',
            length: 5000,
        });
        ResetDrugSaleVariables();
        TaskWanderStandard(npc, 10.0, 10.0);

        setTimeout(() => {
            SetEntityAsNoLongerNeeded(npc_buyer);
        }, 35000);
    }
}

RegisterNetEvent('NLRP:DRUGS_AVAILABLE');
AddEventHandler('NLRP:DRUGS_AVAILABLE', () => {
    const player = PlayerPedId();

    // Make sure the player is not inside a vehicle and not dead or dying.
    if (!IsPedInAnyVehicle(player, true) && !IsPedDeadOrDying(player)) {
        const start = GetEntityCoords(player);
        const end = GetOffsetFromEntityInWorldCoords(player, 0.0, 1.15, 0.10); // 1.15 feet in front of the character
        const raycast = StartShapeTestCapsule(start[0], start[1], start[2], end[0], end[1], end[2], 0.5, 12, player, 7);
        const raycast_result = GetShapeTestResult(raycast); // Get the results of the raycast above.
        const NPC = raycast_result[4]; // The entity that was hit by the ray.

        // Perform some initial checks on the NPC to determine if they're suitable to sell drugs to.
        // Make sure the NPC exists, is alive, is NOT type 28 (an animal), is not a player, and not in a vehicle.
        if (DoesEntityExist(NPC) && !IsPedDeadOrDying(NPC) && GetPedType(NPC) !== 28 && !IsPedAPlayer(NPC) && !IsPedInAnyVehicle(NPC, true)) {
            if (IsValidSaleTarget(NPC)) {
                // At this point the sale has been officially initiated.
                // Make sure the NPC turns to face the player to make the deal realistic.
                emit("mythic_notify:client:SendAlert", {
                    type: 'inform',
                    text: 'Negotiating sale..',
                    length: 5000,
                });
                TaskTurnPedToFaceEntity(NPC, player, 2500);
                buyer = NPC;
                started_sale = true;
            }
        }

    }
});

setTick(() => {
    const player = PlayerPedId();

    if (started_sale && !actively_selling_drugs) {
        actively_selling_drugs = true;
        sale_started_timestamp = GetGameTimer();
        SellDrugsToNPC(player, buyer);
    }

    if (IsControlJustReleased(1, 194)) { // Player Pressed Backspace. Cancels an active drug sale.
        if (actively_selling_drugs) {
            sale_cancelled = true;
        }
    }

    if (IsControlJustReleased(1, 38)) { // Player Pressed E
        // Make sure the player is not already in the process of selling drugs.
        if (!started_sale) {
            const player = PlayerPedId();

            if (isDurationComplete(selling_cooldown_timestamp, 2000) && !IsPedInAnyVehicle(player, true)) {
                // Make sure that the selling cooldown has passed so the database hit and raycast can't be triggered too often.
                const start = GetEntityCoords(player);
                const end = GetOffsetFromEntityInWorldCoords(player, 0.0, 1.15, 0.10); // 1.15 feet in front of the character
                const raycast = StartShapeTestCapsule(start[0], start[1], start[2], end[0], end[1], end[2], 0.5, 12, player, 7);
                const raycast_result = GetShapeTestResult(raycast); // Get the results of the raycast above.
                const NPC = raycast_result[4];

                if (DoesEntityExist(NPC)) {
                    selling_cooldown_timestamp = GetGameTimer();
                    TriggerServerEvent("NLRP:CHECK_DRUG_INVENTORY");
                }
            }
        }
    }
});
