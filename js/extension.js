var Random;
if(typeof(Random) == "undefined")
    Random = { }

if(typeof(Random.Extension) == "undefined")
    Random.Extension = { }
    
Random.Extension.Data = { 
        AppName:                        "Tab Maniac",
        DefaultCheckFrequencySeconds:   3600,
        PeriodHours:                    6,
        DbVersion:                      1,
        DbName:                         "TabVault",
        MaxRecords:                     20
    }

Random.Extension.GetPeriod = function()
{
    var period = Random.Extension.Ls.GetItem(RANDOM_EXT_LS_KEY_SAVEPERIOD);

    if(period == false || period < 1)
    {
        period = Random.Extension.Data.PeriodHours;
        Random.Extension.Ls.SetItem(RANDOM_EXT_LS_KEY_SAVEPERIOD, period);
    }

    return period;
}

Random.Extension.ThrowError = function(message, data)
{
    console.error(Random.Extension.Data.AppName + " had a critical error: " + message, data);
    
    // Stop execution.
    throw data;
}

Random.Extension.LogInfo = function(message, data)
{
    if(typeof(console) != "undefined" && typeof(console.log) != "undefined")
        console.log(message, data);
}

Random.Extension.LogWarn = function(message, data)
{
    if(typeof(console) != "undefined" && typeof(console.warn) != "undefined")
        console.warn(message, data);
}

Random.Extension.GetTimestampString = function(options)
{
    // Arguments:
    //
    // OnlyDate:    (req) readonly bool
    // Nice:        (req) readonly bool
    //

    var onlyDate    = options.OnlyDate;
    var nice        = options.Nice;
    
    function prepare(num)
    {
        var str = String(num);

        if(str.length < 2)
            str = "0" + str;

        return str;
    }

    var today = new Date();
    var yyyy = today.getFullYear();
    var mm = today.getMonth() + 1;
    var dd = today.getDate();
    var hh = today.getHours();
    var min = today.getMinutes();

    var string;
    if(nice)
    {
        if(onlyDate)
            string = (String(yyyy) + "-" + prepare(mm) + "-" + prepare(dd));
            
        else
            string = (String(yyyy) + "-" + prepare(mm) + "-" + prepare(dd) + " " + prepare(hh));// + ":" + prepare(min));
    }
    
    else
    {
        if(onlyDate)
            string = (String(yyyy) + prepare(mm) + prepare(dd));
            
        else
            string = (String(yyyy) + prepare(mm) + prepare(dd) + "-" + prepare(hh) + prepare(min));
    }
        
    return string;
}

Random.Extension.GetObjectTabData = function(options)
{
    // Arguments:
    //
    // Success: (req) function
    //

    var success = options.Success;
    
    chrome.windows.getAll({"populate" : true}, function(windows) {
            var collectedWindows = [];
            var numWindows = windows.length;

            for(var i = 0; i < numWindows; i++)
            {
                var win = windows[i];
                var numTabs = win.tabs.length;

                var collectedTabs = [];
                var activeTab = null;
                for(var j = 0; j < numTabs; j++)
                {
                    var tab = win.tabs[j];
                    
                    if(tab.active)
                        activeTab = j;

                    collectedTabs.push([tab.url.replace(/\t/g, " "), tab.title.replace(/\t/g, " ")]);
                }
                
                collectedWindows.push({ Tabs: collectedTabs, ActiveTab: activeTab });
            }

            success(collectedWindows);
        });
}

Random.Extension.GetFlatTabData = function(options)
{
    // Arguments:
    //
    // Success: (req) function
    //

    var successCallback = options.Success;
    
    chrome.windows.getAll({"populate" : true}, function(windows) {
            var lines = [];
            var numWindows = windows.length;

            for(var i = 0; i < numWindows; i++)
            {
                var win = windows[i];
                var numTabs = win.tabs.length;

                for(var j = 0; j < numTabs; j++)
                {
                    var tab = win.tabs[j];

                    lines.push([i + 1, j + 1, tab.url.replace(/\t/g, " "), tab.title.replace(/\t/g, " ")]);
                }
            }

            successCallback(lines);
        });
}

Random.Extension.CheckForBackup = function(options)
{
    // Arguments:
    //
    // Success: (req) function
    //

    var success = options.Success;
    
    var currentHour = (new Date()).getHours();
    var expectedSaveHour = currentHour - (currentHour % Random.Extension.GetPeriod());

    var timestampString = Random.Extension.GetTimestampString({ OnlyDate: true, Nice: false }) + "-" + expectedSaveHour;
    
    function DbAcquiredInternal(db)
    {
        function KeysRetrievedInternal(list, count)
        {
            if(count > 0)
            {
                success(true)
                return;
            }
            
            function DataAggregatedInternal(tabData)
            {
                Random.Extension.LogInfo("Writing tabs for [" + timestampString + "].");

                var transaction = db.transaction([RANDOM_EXT_TABLE_TABS], IDBTransaction.READ_WRITE)
                var store = transaction.objectStore(RANDOM_EXT_TABLE_TABS);

                function InsertNewInternal()
                {
                    try
                    {
                        var data = {
                                FormalTimestamp:    Random.Extension.GetTimestampString({ OnlyDate: false, Nice: true }),
                                TabData:            tabData
                            }

                        data[RANDOM_EXT_PK_TABS] = timestampString;

                        var request = store.put(data);
                    }
                    
                    catch(e)
                    {
                        Random.Extension.ThrowError("Exception for write of new entry.", e);
                        return;
                    }
                    
                    request.onerror = function(ev) {
                            Random.Extension.ThrowError("Could not write new entry: " + ev.target.errorCode);
                        }

                    request.onsuccess = function(ev) {
                            success(false);
                        }
                }
                
                if(count > 0)
                    return;
                
                InsertNewInternal();

                var ptr = 0;
                function ClipOldRecords(totalList, totalCount)
                {
                    if(totalCount <= Random.Extension.Data.MaxRecords)
                        return;
                
                    var key = list[ptr];
                    ptr++;
                    totalCount--;
                    
                    Random.Extension.LogInfo("Delete old tabs record with ID [" + key + "].");
                    
                    var request = store.delete(key);
                    
                    request.onerror = function(ev) {
                            Random.Extension.ThrowError("Could not delete old tabs record with key [" + key + "] in position (" + ptr + "): " + ev.target.errorCode);
                        }

                    request.onsuccess = function(ev) {
                            ClipOldRecords();
                        }
                }
                
                Random.Extension.GetAllBackups({ Success: ClipOldRecords });
            }
            
            Random.Extension.GetObjectTabData({ Success: DataAggregatedInternal });
        }

        Random.Extension.Indexed.GetFromStore({
                Db:         db,
                StoreName:  RANDOM_EXT_TABLE_TABS,
                Success:    KeysRetrievedInternal,
                GetValues:  false,
                Only:       timestampString
            });
    }

    Random.Extension.Indexed.GetDb({ Success: DbAcquiredInternal });
}

Random.Extension.GetAllBackups = function(options)
{
    // Arguments:
    //
    // Success: (req) function
    //

    var success = options.Success;

    function DbAcquiredInternal(db)
    {
        var transaction = db.transaction([RANDOM_EXT_TABLE_TABS], IDBTransaction.READ_ONLY)
        var store = transaction.objectStore(RANDOM_EXT_TABLE_TABS);

        function RecordsRetrievedInternal(list, count)
        {
            success(list, count);
        }
    
        Random.Extension.Indexed.GetFromStore({
                Db:         db,
                StoreName:  RANDOM_EXT_TABLE_TABS,
                Success:    RecordsRetrievedInternal,
                GetValues:  true
            });
    }

    Random.Extension.Indexed.GetDb({ Success: DbAcquiredInternal });
}

Random.Extension.MainLoop = function()
{
    function CheckCompleteInternal()
    {
        setTimeout(Random.Extension.MainLoop, Random.Extension.Data.DefaultCheckFrequencySeconds * 1000);
    }
    
    Random.Extension.CheckForBackup({ Success: CheckCompleteInternal });
}
