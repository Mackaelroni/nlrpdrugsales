ESX = nil
local PlayerData = {}

function Notify(message)
	SetNotificationTextEntry("STRING");
	AddTextComponentString(message);
	DrawNotification(true, false);
end

--Runs once at the start of the script
Citizen.CreateThread(function()
	while ESX == nil do
		TriggerEvent('esx:getSharedObject', function(obj) ESX = obj end)
		Citizen.Wait(0)
	end

	while ESX.GetPlayerData().job == nil do
		Citizen.Wait(10)
	end

	PlayerData = ESX.GetPlayerData()
end)

-- Sets the player decor as an outlaw.
Citizen.CreateThread(function()
    while true do
        Wait(100)
        if NetworkIsSessionStarted() then
            DecorRegister("IsOutlaw",  3)
            DecorSetInt(GetPlayerPed(-1), "IsOutlaw", 1)
            return
        end
    end
end)

-- Info that you dont have drugs
RegisterNetEvent('NLRP:NO_DRUG_STOCK')
AddEventHandler('NLRP:NO_DRUG_STOCK', function()
    exports['mythic_notify']:DoCustomHudText('error', 'You don\'t have any drugs to sell!', 2500)
end)

-- Triggered to report the player to the police for selling drugs.
AddEventHandler('NLRP:REPORT_DRUG_DEALER_TO_POLICE', function()
    local player = PlayerPedId()
    local player_coords = GetEntityCoords(player)
    local s1, s2 = Citizen.InvokeNative( 0x2EB41072B4C1E4C0, player_coords.x, player_coords.y, player_coords.z, Citizen.PointerValueInt(), Citizen.PointerValueInt() )
    local street1 = GetStreetNameFromHashKey(s1)
    local street2 = GetStreetNameFromHashKey(s2)
    DecorSetInt(player, "IsOutlaw", 2)

    ESX.TriggerServerCallback('esx_skin:getPlayerSkin', function(skin, jobSkin)
        local sex = nil

        if skin.sex == 0 then
            sex = "male"
        else
            sex = "female"
        end

        TriggerServerEvent('NLRP:REPORT_SALE_LOCATION', player_coords.x, player_coords.y, player_coords.z)

        if s2 == 0 then
            TriggerServerEvent('NLRP:POLICE_REPORT_SALE_IN_PROGRESS', street1, sex)
        elseif s2 ~= 0 then
            TriggerServerEvent('NLRP:POLICE_REPORT_SALE_IN_PROGRESS_ALT', street1, street2, sex)
        end
    end)
end)

-- Notification to police of a drug sale at a location.
RegisterNetEvent('NLRP:OUTLAW_NOTIFICATION')
AddEventHandler('NLRP:OUTLAW_NOTIFICATION', function(alert_message)
	if PlayerData.job ~= nil and PlayerData.job.name == 'police' then
        Notify(alert_message)
    end
end)

-- The location of the reported drug sale sent to on-duty police.
local blipTime = 40 -- In Seconds
RegisterNetEvent('NLRP:DRUG_SALE_LOCATION')
AddEventHandler('NLRP:DRUG_SALE_LOCATION', function(tx, ty, tz)
	if PlayerData.job.name == 'police' then
		local transT = 250
		local Blip = AddBlipForCoord(tx, ty, tz)

		SetBlipSprite(Blip, 10)
		SetBlipColour(Blip, 1)
		SetBlipAlpha(Blip, transT)
		SetBlipAsShortRange(Blip, false)

		while transT ~= 0 do
			Wait(blipTime * 4) -- Reduce the opacity of the blip constantly until it disappears.
			transT = transT - 1
			SetBlipAlpha(Blip, transT)

			if transT == 0 then
				RemoveBlip(Blip)
				return
			end
		end
	end
end)
