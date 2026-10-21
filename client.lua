
local tabletOpen = false

local function setTabletOpen(state)
    tabletOpen = state

    SetNuiFocus(state, state)

    SendNUIMessage({
        action = state and 'open' or 'close'
    })

    if state then
        SendNUIMessage({
            action = 'data',
            data = {
                balance = 0,
                transactions = {}
            }
        })
    end
end

RegisterCommand('compta', function()
    setTabletOpen(not tabletOpen)
end, false)

RegisterNUICallback('close', function(_, cb)
    setTabletOpen(false)
    cb({ ok = true })
end)

RegisterNUICallback('requestData', function(_, cb)
    SendNUIMessage({
        action = 'data',
        data = {
            balance = 0,
            transactions = {}
        }
    })

    cb({ ok = true })
end)

RegisterNUICallback('transaction', function(_, cb)
    SendNUIMessage({
        action = 'notify',
        message = 'Le serveur de comptabilite n est pas encore configure.',
        kind = 'error'
    })

    cb({ ok = false })
end)

RegisterNUICallback('openExternal', function(_, cb)
    cb({})
end)

AddEventHandler('onResourceStop', function(resourceName)
    if resourceName == GetCurrentResourceName() then
        SetNuiFocus(false, false)
    end
end)
