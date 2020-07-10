ESX = nil

TriggerEvent('esx:getSharedObject', function(obj) ESX = obj end)

function determineSaleSize(total_stock)
    local luck = math.random(1, 100)

    if total_stock <= 5 then
        return math.random(1, total_stock)
    elseif total_stock > 5 and total_stock <= 10 then
        --The player has between 6 and 10 units in stock
        if luck <= 70 then
            return math.random(1, 5)
        else
            return math.random(3, total_stock)
        end
    elseif total_stock > 10 and total_stock <= 50 then
        --The player has between 11 and 50 units in stock
        if luck <= 95 then
            return math.random(1, 10)
        else
            return math.random(10, total_stock)
        end
    else
        --The player has greater than 50 units in stock
        if luck <= 85 then
            return math.random(1, 10)
        elseif luck > 85 and luck <= 95 then
            return math.random(5, 20)
        elseif luck > 95 and luck <= 99 then
            return math.random(10, 50)
        else
            return math.random(20, total_stock)
        end
    end
end

RegisterServerEvent('NLRP:CHECK_DRUG_INVENTORY')
AddEventHandler('NLRP:CHECK_DRUG_INVENTORY', function()
    local _source = source
	local xPlayer = ESX.GetPlayerFromId(_source)

    -- Check the number of on-duty police at the moment.
    local xPlayers = ESX.GetPlayers()
	local police = 0

	for i = 1, #xPlayers, 1 do
 		local xPlayer = ESX.GetPlayerFromId(xPlayers[i])

 		if xPlayer.job.name == 'police' then
			police = police + 1
		end
	end

    if police >= Config.CopsRequiredToSell then
        --Determine the current stock of different drugs the player has.
        local crystalmeth_stock = xPlayer.getInventoryItem('bagofcrystalmeth').count
        if Config.SellCrystalMeth and crystalmeth_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end

        local whiteheroin_stock = xPlayer.getInventoryItem('bagofwhiteheroin').count
        if Config.SellWhiteHeroin and whiteheroin_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end

        local dirtymeth_stock = xPlayer.getInventoryItem('bagofdirtymeth').count
        if Config.SellDirtyMeth and dirtymeth_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end

        local coke_stock = xPlayer.getInventoryItem('bagofcoke').count
        if Config.SellCoke and coke_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end

        local dirtyheroin_stock = xPlayer.getInventoryItem('bagofdirtyheroin').count
        if Config.SellDirtyHeroin and dirtyheroin_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end

        local joint_stock = xPlayer.getInventoryItem('joint').count
        if Config.SellJoint and joint_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end

        local weed_stock = xPlayer.getInventoryItem('bagofweed').count
        if Config.SellWeed and weed_stock > 0 then
            TriggerClientEvent('NLRP:DRUGS_AVAILABLE', _source)
            return
        end


        TriggerClientEvent('NLRP:NO_DRUG_STOCK', _source)
    else
        TriggerClientEvent('mythic_notify:client:SendAlert', _source, { type = 'error', text = 'There must be a minimum of ' .. Config.CopsRequiredToSell .. ' police on duty to sell drugs to locals.', length = 2500 })
    end
end)

RegisterServerEvent('NLRP:SELL_DRUGS_TO_BUYER')
AddEventHandler('NLRP:SELL_DRUGS_TO_BUYER', function()
    local _source = source
	local xPlayer = ESX.GetPlayerFromId(_source)

    --Determine the current stock of different drugs the player has.
    local dirtymeth_stock = xPlayer.getInventoryItem('bagofdirtymeth').count
    local crystalmeth_stock = xPlayer.getInventoryItem('bagofcrystalmeth').count
    local coke_stock = xPlayer.getInventoryItem('bagofcoke').count
    local dirtyheroin_stock = xPlayer.getInventoryItem('bagofdirtyheroin').count
    local whiteheroin_stock = xPlayer.getInventoryItem('bagofwhiteheroin').count
    local joint_stock = xPlayer.getInventoryItem('joint').count
    local weed_stock = xPlayer.getInventoryItem('bagofweed').count

    local quantity_to_sell = 0
    local money = 0
    local selectedDrug = nil

    --Try to sell to the NPC in order of the most expensive drugs.
    --Cocaine, Heroin, Meth, Opium, Crack, Dabs, Marijuana
    if Config.SellCoke and coke_stock > 0 then
        selectedDrug = 'bagofcoke'
        quantity_to_sell = determineSaleSize(coke_stock)
        money = Config.CokePrice * quantity_to_sell
    elseif Config.SellWhiteHeroin and whiteheroin_stock > 0 then
        selectedDrug = 'bagofwhiteheroin'
        quantity_to_sell = determineSaleSize(whiteheroin_stock)
        money = Config.WhiteHeroinPrice * quantity_to_sell
    elseif Config.SellCrystalMeth and crystalmeth_stock > 0 then
        selectedDrug = 'bagofcrystalmeth'
        quantity_to_sell = determineSaleSize(crystalmeth_stock)
        money = Config.CrystalMethPrice * quantity_to_sell
    elseif Config.SellDirtyMeth and dirtymeth_stock > 0 then
        selectedDrug = 'bagofdirtymeth'
        quantity_to_sell = determineSaleSize(dirtymeth_stock)
        money = Config.DirtyMethPrice * quantity_to_sell
    elseif Config.SellDirtyHeroin and dirtyheroin_stock > 0 then
        selectedDrug = 'bagofdirtyheroin'
        quantity_to_sell = determineSaleSize(dirtyheroin_stock)
        money = Config.DirtyHeroinPrice * quantity_to_sell
    elseif Config.SellWeed and weed_stock > 0 then
        selectedDrug = 'bagofweed'
        quantity_to_sell = determineSaleSize(weed_stock)
        money = Config.WeedPrice * quantity_to_sell
    elseif Config.SellJoint and joint_stock > 0 then
        selectedDrug = 'joint'
        quantity_to_sell = determineSaleSize(joint_stock)
        money = Config.JointPrice * quantity_to_sell
    else
        TriggerClientEvent('NLRP:NO_DRUG_STOCK', _source)
		return
    end

    if selectedDrug ~= nil then
        xPlayer.removeInventoryItem(selectedDrug, quantity_to_sell)
		local logitem = ('Drug Sale: ' ..selectedDrug.. ' quantity ' ..quantity_to_sell)
			--print (logitem)
			local pname = GetPlayerName(_source)
			--print(pname)
			local cname = GetPlayerName(_source)
			--print(cname)
			--print(amount)
			--PerformHttpRequest('INSERT DISCORD WEBHOOK HERE IF LOGGING NECESSARY', function(err, text, headers) end, 'POST', json.encode({username = (cname..' ['.._source..']'..' ['..pname..']'), content = logitem}), { ['Content-Type'] = 'application/json' })
    end

    xPlayer.addAccountMoney('money', money)
	local logitem = ('Drug Sale Made  :  ' ..money)
			--print (logitem)
			local pname = GetPlayerName(_source)
			--print(pname)
			local cname = GetPlayerName(_source)
			--print(cname)
			--print(amount)
			--PerformHttpRequest('INSERT DISCORD WEBHOOK HERE IF LOGGING NECESSARY', function(err, text, headers) end, 'POST', json.encode({username = (cname..' ['.._source..']'..' ['..pname..']'), content = logitem}), { ['Content-Type'] = 'application/json' })

    --Variations on the notification received after making the sale.
    if quantity_to_sell >= 1 and quantity_to_sell <= 10 then
        TriggerClientEvent('mythic_notify:client:SendAlert', _source, { type = 'inform', text = 'You sold a small batch of '.. quantity_to_sell .. ' ' .. selectedDrug .. ' for $'.. money, length = 2500 })
    elseif quantity_to_sell > 10 and quantity_to_sell <= 25 then
        TriggerClientEvent('mythic_notify:client:SendAlert', _source, { type = 'inform', text = 'You sold a solid batch of '.. quantity_to_sell .. ' ' .. selectedDrug .. ' for $'.. money, length = 2500 })
    elseif quantity_to_sell > 25 and quantity_to_sell <= 50 then
        TriggerClientEvent('mythic_notify:client:SendAlert', _source, { type = 'inform', text = 'You sold a large batch of '.. quantity_to_sell .. ' ' .. selectedDrug .. ' for $'.. money, length = 2500 })
    end
end)

RegisterServerEvent('NLRP:POLICE_REPORT_SALE_IN_PROGRESS')
AddEventHandler('NLRP:POLICE_REPORT_SALE_IN_PROGRESS', function(street, sex)
    TriggerClientEvent("NLRP:OUTLAW_NOTIFICATION", -1, "~y~There is a " .. sex .. " suspect near " .. street .. " peddling drugs.")
end)

RegisterServerEvent('NLRP:POLICE_REPORT_SALE_IN_PROGRESS_ALT')
AddEventHandler('NLRP:POLICE_REPORT_SALE_IN_PROGRESS_ALT', function(street1, street2, sex)
    TriggerClientEvent("NLRP:OUTLAW_NOTIFICATION", -1, "~y~There is a " .. sex .. " suspect near " .. street1 .. " and " .. street2 .. " peddling drugs.")
end)

RegisterServerEvent('NLRP:REPORT_SALE_LOCATION')
AddEventHandler('NLRP:REPORT_SALE_LOCATION', function(gx, gy, gz)
	TriggerClientEvent('NLRP:DRUG_SALE_LOCATION', -1, gx, gy, gz)
end)


