title: Date rules engine
--

The date rules engine is designed to solve a set of input rules about a set of named dates. These are defined in a @ruleset@, using a custom input language. It willl attempt to solve any conflicts, or, where this is not possible (due to contradictory or missing inputs), it will make a best guess and output a string indicating the problem.

h2. Services


h3(service).  
@"haplo:date_rule_engine:get_rules"@  
@"haplo:date_rule_engine:get_rules:"+rulesetName@
function( R )

@R@ is the @builder@ object for the ruleset.

Used to define a ruleset. Rulesets are group of date rules that conceptually belong together, because they depend on each other and no other dates. As a consequence of this different rulesets should be independent of each other.


h3(service).  
@"haplo:date_rule_engine:update_dates"@
function(inputDates, rulesetName, flags, suspensions, object)

@inputDates@ is an object of dates to be input to the calculation. These are organised as:
<pre>{ name: [minDate, maxDate] }</pre>
Note min and max can be the same, indicating an instantaneous date.

@rulesetName@ defines which ruleset to use, and @flags@ is an array of arbitrary control strings, which affect the dates calculations.

@suspensions@ are a list of periods that shouldn't count as active when working out period end rules. These should be in the form @[startDate, endDate]@

@object@ is a storeObject that this rulest relates to. This is used internally for deduplication and saving of state between calculations.

h3(service).  
@"haplo:date_rule_engine:compute_dates"@
function(inputDates, rulesetName, flags, suspensions, object)

Works as @"haplo:date_rule_engine:update_dates"@, but crucially doesn't save the recalculated state. Only use where you are not expecting to be saving the dates you are calculating.


h3(service). @"haplo:date_rule_engine:update_dates_ignoring_previous_state"@  
function(inputDates, rulesetName, flags, suspensions, object)

*Use with caution*

Results for @periodEndRule@ have an internal state that is maintained. This allows the recalculation to have the "scaling" effect described below. However it also persists errors if any are introduced.

This service is for administrative action to deliberately wipe all previously saved state, and recalculate all dates based on that clean state.

h3(service).  
@"haplo:date_rule_engine:compute_dates_ignoring_previous_state"@
function(inputDates, rulesetName, flags, suspensions, object)

Works as @"haplo:date_rule_engine:update_dates_ignoring_previous_state"@, but crucially doesn't save the recalculated state. Only use where you are not expecting to be saving the dates you are calculating. This service should not be necessary very often, but is not unsafe to use in the same way as @"haplo:date_rule_engine:update_dates_ignoring_previous_state"@.

h3(service).
@"haplo:date_rule_engine:get_project_state_table"@
function(projectRef)

Returns an object containing state table(s) for the provided project ref. Multiple implementations/rulesets will result in multiple state tables. Each table will have a 'rulesetName', an 'object' (ref) and 'state'. Each state contains date objects based on project dates containing projectStart, projectEnd, periodLastUpdated, periodFractionLeast, periodFractionMost, periodLengthLeast, periodLengthMost properties.

h2. Defining a ruleset

Rules are defined as objects with keyword keys, used with builder funcitons to define a ruleset.

h3. Keywords

Keywords define rules. Some have to be used in logical groups. These allow rules to be read in a literate manner.

Conditionals respond to @flags@ passed as inputs to the calculation. Flags are arbitrary strings, usually describing something in your problem.

h4. add, to

h4. subtract, from

h4. if, then, else

h4. case

h4. or

h4. and

h3. Example ruleset definition

<pre>
P.implementService("haplo:date_rule_engine:get_rules:test:rules:test1", function(R) {
    R.input("easter");
    R.dateRule("start", {add: R.months(0,2), to: "easter"});
    R.dateRule("meeting", {subtract: R.weeks(1,2), from: "start"});
    R.dateRule("teatime", {"if": "hungry", then: "start", "else": "meeting"});
    R.dateRule("suppertime", {"case": [{hungry: "start"}, {famished: "meeting"}, {"ELSE": "teatime"}]});
    R.dateRule("eating", {or: ["teatime","suppertime"]});
    R.dateRule("meating", {and: ["eating","meeting"]});
    R.dateRule("bedtime", {add: R.years(1,1), to: "end"});
    R.periodEndRule("end", "easter", {
        "if": "hungry",
        then: {add: R.days(10,20), to: "easter"},
        "else": {add: R.days(30,40), to: "easter"}
    });
});
</pre>

In the above example @hungry@ and @famished@ are flags that could be passed into the calculation at runtime.


h2. Builder API

All of the functions in the api are properties of the builder object, @R@.

h3(function). input(name)                         

Defines the date called @name@ as an input to the ruleset.


h3(function). dateRule(name, rule)               

Defines static rules to calculate date @name@, eg. "the registration deadline must be within 3 months of starting the project".


h3(function). periodEndRule(name, startDate, rule)

Date periods define periods of time that should scale appropriately in response to changes in the inputs. So if you are half way through a period, you should be half way through the new period length of time when the rule changes.

For example, if you have done 2 years of a 4 year period when the inputs change, such that the new period length is 6 years, you will have 3 years of the period left to complete.

Suspension periods only apply to periodEndRules, so it's a good idea to use these by default for anything you think should move when a suspension is applied. Alerts and anything else calculated from a a period end rule do not need to be period end rules themselves.

h3. Utility functions

These define lengths of time for use in rulesets.

h3(function). years(min, max)

h3(function). months(min, max)

h3(function). weeks(min, max)

h3(function). days(min, max)


h2. Calculation details

h3. Period end rules

Period end rules work out the end date of a a defined period based on a start date, a rule, state we know about the period so far, and suspensions that apply. 

The start date is the date that the period started. We make the assumption that this will not change in subsequent calculations, and behaviour if it does change is not well defined.

The rule could be of the form {add: R.weeks(1,2), to: "start"}, for instance. This is used to calculate what the date would be using regular rule calculation, to give us a baseline of how long the period should be.

The state is saved for each ruleset and object. For each date we have:

@state[dateName]@ = an object containing state particular to that date computation.
@state[dateName].periodStart@ = (deprecated) [start XDate, end XDate] period start range 
@state[dateName].periodEnd@ = (deprecated) [start XDate, end XDate] projected period end range 
@state[dateName].periodLengthLeast@ = The previous (active) length of the period (shortest version)
@state[dateName].periodLengthMost@ = The previous (active) length of the period (longest version)
@state[dateName].periodFractionLeast@ = least fraction (periodLastUpdate as a fraction from midpoint of periodStart to midpoint of periodEnd)
@state[dateName].periodFractionMost@ = most fraction (periodLastUpdate as a fraction from midpoint of periodStart to midpoint of periodEnd)
@state[dateName].periodLastUpdated@ = XDate periodTimeUsed last calculated

Suspensions are an array of arrays of two XDates, in order by the start date, and non-overlapping. This cleaning up of suspensions is done by the engine, so the suspensions array is guaranteed to be valid.

The way a period end rule is calculated is:

First, find out what the end dates of the period would be as a regular date, and use this to find the new active length of the period.

Then, calculate how far through the period we are now. If there is no state saved, we initialise the state, setting the period start length to the length of the newly calculated period, and the fractions to 0. Last updated is set to the start date.

We calculate how much of the time since the last updated date as been active (i.e. not overlapping a suspension). We find the proportion of the full previous length of the period that this active time since last updated represents, and add this to the previous fraction. We then add the new length of the period multipled by 1 minus the total fraction of active time elapsed.

This gives us a provisional end date. To this, we add any suspensions between now and the provisional end date, in order, so that if the end date moves, any suspensions that become relevant are added.

Warning about calculations including suspensions: Any new suspensions that start before the current time and also before a previous calculation of the dates will not have the time between the start of the suspension and the last recalculation included as suspension when calculating.
