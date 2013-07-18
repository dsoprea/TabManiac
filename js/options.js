var Random;
if(typeof(Random) == "undefined")
    Random = { }
    
if(typeof(Random.Extension) == "undefined")
    Random.Extension = { }

if(typeof(Random.Extension.Options) == "undefined")
    Random.Extension.Options = { }

Random.Extension.Options.Data = {
    }

// Saves options to localStorage:
Random.Extension.Options.SaveOptions = function()
{
    var period = document.getElementById("period").value;

    if(!period.length)
    {
        alert("Period cannot be empty!");
        return;
    }

    period = parseInt(period, 10);

    if(!period || (period < 1))
    {
        alert("Period cannot be less than 1 minute!");
        return;
    }

    Random.Extension.Ls.SetItem(RANDOM_EXT_LS_KEY_SAVEPERIOD, period);

    // Update status to let user know options were saved.
    var $status = $(".status");
    $status.html("Config updated. Please restart the browser.");
    $status.show();
}

// Restores select box state to saved value from localStorage:
Random.Extension.Options.RestoreOptions = function()
{
    var period = Random.Extension.GetPeriod();
    $("#period").val(period);
}

Random.Extension.Options.Boot = function()
{
    Random.Extension.Options.RestoreOptions();
    
    function BackupsRetrievedInternal(records, count)
    {
        var $historyList = $(".main .history-box .list");

        if(count > 0)
        {
            $(".main .history-box").show();

            function DeleteRecordInternal()
            {
                var $this = $(this);
                var timestampString = $this.parents(".history-item").attr("key");

                function DbAcquiredInternal(db)
                {
                    function RecordsRetrievedInternal(list, count)
                    {
                        var transaction = db.transaction([RANDOM_EXT_TABLE_TABS], 'readwrite')
                        var store = transaction.objectStore(RANDOM_EXT_TABLE_TABS);

                        var request = store.delete(timestampString);
                        
                        request.onerror = function(ev) {
                                Random.Extension.ThrowError("Could not delete tab record with key [" + key + "]: " + ev.target.errorCode);
                            }

                        request.onsuccess = function(ev) {
                                // Refresh page.
                                window.location = window.location;
                            }
                    }
                
                    Random.Extension.Indexed.GetFromStore({
                            Db:         db,
                            StoreName:  RANDOM_EXT_TABLE_TABS,
                            Success:    RecordsRetrievedInternal,
                            GetValues:  false
                        });
                }

                Random.Extension.Indexed.GetDb({ Success: DbAcquiredInternal });
                
                return false;
            }
            
            function OpenTabsInternal()
            {
                var $this = $(this);
                var timestampString = $this.parents(".history-item").attr("key");
            
                function DbAcquiredInternal(db)
                {
                    function RecordsRetrievedInternal(list, count)
                    {
                        if(count == 0)
                            Random.Extension.ThrowError("Could not open tabs for key [" + key + "]: " + ev.target.errorCode);
                    
                        var record;
                        for(var timestampString in list)
                        {
                            record = list[timestampString];
                            
                            break;
                        }

                        function LoadCompleteInternal()
                        {
                        
                        }
                        
                        var i = 0;
                        var lastWindowActiveTab;
                        function LoadWindow(createdWindow)
                        {
                            // If a window was just created (which will be all 
                            // but the first invocation), activate the correct tab.
                            if(createdWindow != null)
                            {
                                var tabId = createdWindow.tabs[lastWindowActiveTab].id;
                                chrome.tabs.update(tabId, { active: true }, function() { })
                            }
                            
                            if(i >= record.TabData.length)
                            {
                                LoadCompleteInternal();
                                return;
                            }
                        
                            var tabInfo = record.TabData[i];
                            var tabSets = tabInfo.Tabs;
                            lastWindowActiveTab = tabInfo.ActiveTab;
                            
                            var urls = []
                            for(var j in tabSets)
                                urls.push(tabSets[j][0]);
                            
                            i++;
                            
                            chrome.windows.create({ url: urls }, LoadWindow);
                        }
                        
                        LoadWindow(null);
                    }
                
                    Random.Extension.Indexed.GetFromStore({
                            Db:         db,
                            StoreName:  RANDOM_EXT_TABLE_TABS,
                            Success:    RecordsRetrievedInternal,
                            Only:       timestampString,
                            GetValues:  true
                        });
                }

                Random.Extension.Indexed.GetDb({ Success: DbAcquiredInternal });

                return false;
            }
            
            $(".history-box .history-item .delete-button .link-me").live("click", DeleteRecordInternal);
            $(".history-box .history-item .open-button .link-me").live("click", OpenTabsInternal);
            
            for(var timestampString in records)
            {
                var record = records[timestampString];
                var formalTimestamp = record.FormalTimestamp;
                var tabData = record.TabData;
            
                var $historyItem = $(
                                "<div class='history-item' key='" + timestampString + "'>" +
                                    "<div class='time-string'></div>" +
                                    "<div class='stats'></div>" +
                                    "<div class='open-button'><a href='#' class='link-me'>open</a></div>" +
                                    "<div class='delete-button'><a href='#' class='link-me'>delete</a></div>" +
                                    "<div class='float-stop'></div>" +
                                "</div>"
                            );
                
                var numWindows = tabData.length;
                var numTabs = 0;
                for(var i in tabData)
                {
                    var oneWindow = tabData[i];
                
                    numTabs += oneWindow.Tabs.length;
                }
    
                statsString = "Windows: " + numWindows + ", Tabs: " + numTabs;
    
                $(".time-string", $historyItem).text(formalTimestamp);
                $(".stats", $historyItem).text(statsString);
    
                $historyItem.appendTo($historyList);
            }
        }
    }
    
    Random.Extension.GetAllBackups({ Success: BackupsRetrievedInternal });
}

$(Random.Extension.Options.Boot);
