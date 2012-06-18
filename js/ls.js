var Random;
if(typeof(Random) == "undefined")
    Random = { }

if(typeof(Random.Extension) == "undefined")
    Random.Extension = { }

var RANDOM_EXT_LS_KEY_SAVEPERIOD = "tabmaniac;saveperiod";

Random.Extension.Ls = { }

Random.Extension.Ls.SetItem = function(key, value)
{
    try
    {
        window.localStorage.removeItem(key);
        window.localStorage.setItem(key, value);
    }
    catch(e) { }
}

Random.Extension.Ls.GetItem = function(key)
{
    var value;
    try
    {
        value = window.localStorage.getItem(key);
    }
    catch(e)
    {
        value = "null";
    }

    return value;
}
