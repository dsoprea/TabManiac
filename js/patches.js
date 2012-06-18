var Random;
if(typeof(Random) == "undefined")
    Random = { }

if(typeof(Random.Extension) == "undefined")
    Random.Extension = { }

if(typeof(Random.Extension.Indexed) == "undefined")
    Random.Extension.Indexed = { }

// Patches that are automatically applied as necessary. New databases will be 
// built incrementally.
Random.Extension.Indexed.Patches = {
        StepTo1: function(db, successCallback) {
                // This is the main creation script.
        
                // This table should not exist.
                if(db.objectStoreNames.contains(RANDOM_EXT_TABLE_TABS))
                    db.deleteObjectStore(RANDOM_EXT_TABLE_TABS);

                try
                {
                    var store = db.createObjectStore(RANDOM_EXT_TABLE_TABS, { keyPath: RANDOM_EXT_PK_TABS });
                }
                
                catch(e)
                {
                    Random.Extension.ThrowError("Could not create '" + RANDOM_EXT_TABLE_TABS + "' object-store.", e);
                }

                successCallback();
            }
    }
