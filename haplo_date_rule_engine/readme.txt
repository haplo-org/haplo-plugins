
The dates rule engine is designed to solve a set of input rules about a set of named dates. These are defined in a `ruleset`, using a custom input language. It willl attempt to solve any conflicts, or, where this is not possible (due to contracdictory or missing inputs), it will make a best guess, and output a string indicating the problem.

## Services


    "haplo:date_rule_engine:get_rules"
    "haplo:date_rule_engine:get_rules:"+rulesetName
Args
    R               // The `builder` object for the ruleset. The builder api is described below
    rulesetName
Usage
    This defines a rulest. Rulesets are group of date rules that conceptually belong together, because they depend on each other and no other dates. As a consequence of this different rulesets should be independent of each other.


    "haplo:date_rule_engine:compute_dates"
Args
    inputDates          // Object of dates to be input to the calculation. These are organised as:
                        //  { name: [minDate, maxDate]}    // where min and max can be the same
    rulesetName         // Which ruleset to use
    flags               // An array of arbitrary control strings
    object              // A storeObject this rulest relates to. This is used internally for deduplication
                        //      and saving of state


### Builder API

    input: function(name)                           // Defines the date called `name` as an input to the ruleset
    dateRule: function(name, rule)                  // Sets the rule to calculate date `name`
    periodEndRule: function(name, startDate, rule)  // date `periods` are for periods that should scale appropriately
                        // in response to changes in the inputs. So if you are half way through a period, you should
                        // be half way through the new period length of time when the rule changes
/* These are used for setting timeperiods on rules /*
    years: function(min, max)
    months: function(min, max)
    weeks: function(min, max)
    days: function(min, max)

### Rules
    Rules are defined as object with keyword keys, used in and with builder funcitons to express the kinds
    of rules that define date rulesets eg:

<pre>
P.implementService("haplo:date_rule_engine:get_rules:test:rules:test1", function(R) {
    R.input("submission");
    R.dateRule("start", {add: R.months(0,2), to: "submission"});
    R.dateRule("meeting", {subtract: R.weeks(1,2), from: "start"});
    R.dateRule("teatime", {"if": "hungry", then: "start", "else": "meeting"});
    R.dateRule("suppertime", {"case": [{hungry: "start"}, {famished: "meeting"}]});
    R.dateRule("eating", {or: ["teatime","suppertime"]});
    R.dateRule("meating", {and: ["eating","meeting"]});
    R.dateRule("bedtime", {add: R.years(1,1), to: "end"});
    R.periodEndRule("end", "submission", {"if": "hungry",
                                          then: {add: R.days(10,20), to: "submission"},
                                          "else": {add: R.days(30,40), to: "submission"}});
});
</pre>

/* keywords */
[add, to], [subtract, from], [if, then, else], case, or         // Those in [] must be used together
    
    Conditionals respond to `flags` set on input to the calculation. Flags are arbitrary strings, usually describing something in your problem.

