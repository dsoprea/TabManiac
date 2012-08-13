var Random;
if(typeof(Random) == "undefined")
    Random = { }

if(typeof(Random.Extension) == "undefined")
    Random.Extension = { }

var RANDOM_EXT_TABLE_TABS = "tabs";
var RANDOM_EXT_PK_TABS = "Timestamp";

if(window.mozIndexedDB) 
{
    window.indexedDB        = window.mozIndexedDB;
    window.IDBKeyRange      = window.IDBKeyRange;
    window.IDBTransaction   = window.IDBTransaction;
}

if(window.webkitIndexedDB)
{
    window.indexedDB        = window.webkitIndexedDB;
    window.IDBKeyRange      = window.webkitIDBKeyRange;
    window.IDBTransaction   = window.webkitIDBTransaction;
}

Random.Extension.Indexed = {
        SetDbVersion: function(options) {
                // Arguments:
                //
                // ToVersion:   (req) readonly int
                // Success:     (req) function
                //
                // The purpose of this function is to revert our version during 
                // development. Note that this only works with the setVersion() 
                // technique, which is obsolete if even available.
                
                Random.Extension.Data.DbVersion = options.ToVersion;
                
                Random.Extension.Indexed.GetDb({ Success: options.Success });
            },

        UpdateDb: function(options) {
                // Arguments:
                //
                // Db:          (req) readwrite IDBDatabase
                // FromVersion: (req) readonly int
                // Success:     (req) function
                //

                var db          = options.Db;
                var fromVersion = options.FromVersion * 1;
                var success     = options.Success;
                
                var patchTo = fromVersion;

                // A recursive function to iterate through the patches from the 
                // current version to the latest version. We don't have the 
                // benefit of tail-recursion in Javascript, but we need to 
                // accomodate callbacks for the patch calls.
                function ApplyNextPatchInternal()
                {
                    patchTo++;

                    if(patchTo > Random.Extension.Data.DbVersion)
                    {
                        success(fromVersion, Random.Extension.Data.DbVersion);
                        return;
                    }
                    
                    var patchMethod = ("StepTo" + patchTo);
                    if(typeof(Random.Extension.Indexed.Patches[patchMethod]) != "undefined")
                        Random.Extension.Indexed.Patches[patchMethod](db, ApplyNextPatchInternal);
                        
                    else
                        ApplyNextPatchInternal();
                }
        
                ApplyNextPatchInternal();
            },

        GetDb: function(options) {
                // Arguments:
                //
                // Success: (req) function
                //

                var success = options.Success;
                
                if(typeof(Random.Extension.Data.Db) == "undefined")
                {
                    var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB; 

                    var request = indexedDB.open(Random.Extension.Data.DbName, Random.Extension.Data.DbVersion);
                    
                    function CheckVersionInternal(db, currentVersion, updateType, successInternal)
                    {
                        if(typeof(successInternal) == "undefined")
                            successInternal = function() { }
                    
                        if(currentVersion == "")
                            currentVersion = 0;

                        if(currentVersion != Random.Extension.Data.DbVersion)
                        {
                            Random.Extension.LogInfo("Doing database update.  TYPE= [" + updateType + "]");
                        
                            function UpdateCompleteInternal(oldVersion, newVersion)
                            {
                                successInternal(db);
                            }
                        
                            Random.Extension.Indexed.UpdateDb({
                                    Db:             db,
                                    FromVersion:    currentVersion,
                                    Success:        UpdateCompleteInternal
                                });
                        }
                        
                        else
                            successInternal(db);
                    }

                    // This is, apparently, the new way to perform updates.
                    // We expect that this is not run simultaneously with the 
                    // success callback, and we prefer that it's called -before- 
                    // the success callback.
                    request.onupgradeneeded = function(ev) {
                            var db = ev.target.result;
                            
                            CheckVersionInternal(db, db.version, "implicit");
                        }

                    request.onerror = function(ev) {
                        Random.Extension.ThrowError("Database-open error: " + ev.target.errorCode);
                    }
                    
                    request.onsuccess = function(ev) {
                        Random.Extension.Data.Db = ev.target.result;

                        // Using "setVersion" is, apparently, the obsolete way 
                        // to do updates.
                        var currentVersion = Random.Extension.Data.Db.version;
                        
                        if(currentVersion != Random.Extension.Data.DbVersion && typeof(Random.Extension.Data.Db.setVersion) != "undefined")
                        {
                            var setVrequest = Random.Extension.Data.Db.setVersion(Random.Extension.Data.DbVersion);

                            setVrequest.onfailure = function(ev) {
                                    Random.Extension.ThrowError("Patch failure: " + ev.target.errorCode);
                                }
                                
                            setVrequest.onsuccess = function(ev) {
                                    CheckVersionInternal(Random.Extension.Data.Db, currentVersion, "explicit", function() {
                                            success(Random.Extension.Data.Db);
                                        });
                                }
                        }
                        
                        else
                            success(Random.Extension.Data.Db);
                    }
                }
                
                else
                    success(Random.Extension.Data.Db)
            },

        DoesStoreExist: function(options) {
                // Arguments:
                //
                // StoreName:   (req) readonly string
                // Success:     (req) function
                //
                
                var storeName   = options.StoreName;
                var success     = options.Success;
                
                function DbAcquiredInternal(db)
                {
                    success(db.objectStoreNames.contains(storeName));
                }
                
                Random.Extension.Indexed.GetDb({ Success: DbAcquiredInternal });
            },
        
        GetFromStore: function(options) {
                // Arguments:
                //
                // StoreName:   (req) readonly string
                // Success:     (req) function
                // GetValues:   (opt) readonly bool
                //
                // Optionally, either:
                //
                // LowerBound:  (opt) readonly <scalar>
                // UpperBound:  (opt) readonly <scalar>
                //
                // Or:
                //
                // Only:        (opt) readonly <scalar>
                //

                var db          = options.Db;
                var storeName   = options.StoreName;
                var success     = options.Success;
                var getValues   = (typeof(options.GetValues) != "undefined" ? options.GetValues : false);
                var only        = options.Only;
                var lowerBound  = options.LowerBound;
                var upperBound  = options.UpperBound;

                var transaction = db.transaction([storeName], "readonly")
                var store = transaction.objectStore(storeName);
                
                var keyRange;
                if(typeof(only) != "undefined")
                    keyRange = IDBKeyRange.only(only);
                
                else if(typeof(lowerBound) != "undefined" && typeof(upperBound) != "undefined")
                    keyRange = IDBKeyRange.bound(lowerBound, upperBound);
                    
                else if(typeof(lowerBound) != "undefined")
                    keyRange = IDBKeyRange.lowerBound(lowerBound);
                
                else if(typeof(upperBound) != "undefined")
                    keyRange = IDBKeyRange.upperBound(upperBound);
                
                else
                    keyRange = IDBKeyRange.lowerBound(0);
                
                var cursorRequest = store.openCursor(keyRange);
        
                cursorRequest.onerror = function(ev) {
                        Random.Extension.ThrowError("Could not read for entries in [" + storeName + "]: " + ev.target.errorCode);
                    }

                var keyPath = store.keyPath;
                    
                var list;
                if(getValues) 
                    list = { }
                    
                else
                    list = []

                var count = 0;
                cursorRequest.onsuccess = function(ev) {
                        var result = ev.target.result;
            
                        if(!!result == false)
                        {
                            success(list, count);
                            return;
                        }

                        var key = result.value[keyPath];
                        
                        if(getValues)
                            list[key] = result.value;
                        
                        else
                            list[list.length] = key;

                        count++;
                            
                        result.continue();
                    }
            },
        
        GetStore: function(options) {
                // Arguments:
                //
                // Transaction: (req) IDBTransaction
                // StoreName:   (req) readonly string
                // Success:     (req) function
                //
                
                var transaction = options.Transaction;
                var storeName   = options.StoreName;
                var success     = options.Success;
                
                var store = transaction.objectStore(storeName);
                success(store);
            },
            
        TruncateStore: function(options) {
                // Arguments:
                //
                // Success:     (req) function
                // StoreName:   (req) readonly string
                //

                var success     = options.Success;
                var storeName   = options.StoreName;

                function DbAcquiredInternal(db)
                {
                    function RecordsRetrievedInternal(list, count)
                    {
                        var transaction = db.transaction([storeName], IDBTransaction.READ_WRITE)
                        var store = transaction.objectStore(storeName);

                        var i = 0;
                        function DeleteRecord()
                        {
                            if(i >= list.length)
                            {
                                success(list);
                                return;
                            }

                            var key = list[i];
                            i++;

                            var request = store.delete(key);
                            
                            request.onerror = function(ev) {
                                    Random.Extension.ThrowError("Could not delete record with key [" + key + "] from store with name [" + storeName + "]: " + ev.target.errorCode);
                                }

                            request.onsuccess = function(ev) {
                                    DeleteRecord();
                                }
                        }
                        
                        DeleteRecord();
                    }
                
                    Random.Extension.Indexed.GetFromStore({
                            Db:         db,
                            StoreName:  RANDOM_EXT_TABLE_TABS,
                            Success:    RecordsRetrievedInternal,
                            GetValues:  false
                        });
                }

                Random.Extension.Indexed.GetDb({ Success: DbAcquiredInternal });
            },
            
        DeleteFromStore: function(options) {
                // Arguments:
                //
                // Store:   (req) readwrite IDBObjectStore
                // Key:     (req) readonly string
                // Success: (req) function
                //

                var store       = options.Store;
                var key         = options.Key;
                var success     = options.Success;

                var request = store.delete(key);
                
                request.onerror = function(ev) {
                        Random.Extension.ThrowError("Could not delete record with key [" + key + "] from store with name [" + storeName + "]: " + ev.target.errorCode);
                    }

                request.onsuccess = function(ev) {
                        success(request);
                    }
            },
        
        AddToStore: function(options) {
                // Arguments:
                // 
                // Store:   (req) readwrite IDBObjectStore
                // Data:    (req) readonly object
                // Success: (req) function
                // 

                var store   = options.Store;
                var data    = options.Data;
                var success = options.Success;
                
                try
                {
                    var request = store.put(data);
                }
                
                catch(e)
                {
                    Random.Extension.ThrowError("Exception for write of entry.", e);
                    return;
                }
                
                request.onerror = function(ev) {
                        Random.Extension.ThrowError("Could not write entry: " + ev.target.errorCode);
                    }

                request.onsuccess = function(ev) {
                        success(false);
                    }
            }
    }
