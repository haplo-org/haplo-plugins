title: Advanced date rules engine
--

The date rules engine is designed to evaluate a set of rules in order to compute a set of named dates. The rules are defined in a @ruleset@, but the rules may change with time, so all the rulesets are contained inside a @ruleset history@. As well as the ruleset, the engine requires a log of input events, as will be explained below. As the rules and their interactions may be complicated, the system also computes a "rationale" for every output date, explaining how it was computed; these can be used to diagnose issues, or simply to explain how a date was produced.

h2. Services

h3(service). @"haplo:date_rule_engine_2:get_rules_history"@
@"haplo:date_rule_engine_2:get_rules_history:"+rulesetName@
function( H )

@H@ is the @builder@ object for the ruleset history.

Used to define a ruleset history. Rulesets are groups of date rules and associated information used to compute dates. The history defines how the ruleset has changed over time, and is needed so that the effect of a ruleset change upon existing sets of dates.

h3(service). @"haplo:date_rule_engine_2:compute_dates"@
function(rulesetName, log, now)

@rulesetName@ defines which ruleset to use; the @"haplo:date_rule_engine_2:get_rules_history:"+rulesetName@ service will be invoked to find the ruleset history if it exists, otherwise @"haplo_date_rule_engine_2:get_rules_history"@ will be used.

@log@ is the log of past events effecting this set of dates, as an array of events in a form which will be described below.

@now@ is the point in time (represented as an XDate) at which to compute dates. Ruleset changes in the history, or events in the log, beyond this date will be ignored.

The return value is an object with three keys: @dates@ is a map from computed or input date names to their values as engine date objects, @flags@ is a list of currently set flags, and @activities@ is a map from activity names to objects with the following keys:

@duration@ is the planned duration of the activity, in milliseconds.

@progressFraction@ is the progress through the activity as of @now@, as a number from @0@ to @1@.

@progressTime@ is the progress through the activity as of @now@, in milliseconds.

@inProgressNow@ is a boolean flag that is true if the activity is in progress as of @now@.

@intervals@ is a list of intervals of time that have been completed (or at least started), including both scheduled and unscheduled activity. Each interval is a two-element array of engine date objects representing the start and stop of an interval of activity. The second element of the array may be @null@ for the final interval, representing an interval that is still in progress as of @now@.

@overrides@ is a list of progress overrides applied (via @initialProgressFraction@ or @initialProgressTime@ when a ruleset change occurred, or an explicit @forceProgress@ event. It's an array, each element of which is a three-element array: an engine date object representing when it happened, @"time"@ for an elapsed-time override or @"fraction"@ for a completed-fraction override, and the progress value that was set (in milliseconds or a completion fraction, respectively).

@schedule@ is the activity's schedule, as an array of arrays of two engine date objects reflecting the scheduled starts and stops of scheduled intervals of activity.

h2. Rule engine date objects

Inputs to the date computation are always given as XDates, but dates returned by the system (or used internally in rules) are represented as "rule engine date objects". These wrap an XDate with rationale information, or in error situations, just contain the rationale for the error and no XDate.

A rule engine date object has the following properties:

h3. @xdate@

If present, this is the actual XDate value. If not present, then this date object represents an error; a date could not be computed, but the other fields are still present.

h3. @rationale@

A string describing how this date was generate or, for an error, what went wrong.

Note that this only represents the FINAL step in the computation of the date - the dates that were input to this step will be present in the @inputs@ array, and will have their own rationales, which must be recursively examined.

h2. Repeating dates

A repeating date object has the following methods:

h3(function). isValid()

Returns true if the repeating date object is valid. If it's not valid, the rationale will explain why.

h3(function). getRationale()

Returns a string explaining the origin of the repeating date or, if the date is not valid, explaining what went wrong.

h3(function). getDate(index)

Returns the @index@th instance of the repeating date, starting from @0@, as an engine date object. If the index is beyond the final instance of the repeating date, then an invalid engine date object will be returned with a rationale explaining why.

h3. @inputs@

An array of rule engine date objects that were inputs to the operation that generated this date. They are provided so that their rationales and inputs can be examined in turn, to trace the operations that led to this date being computed.

h2. Defining a Ruleset

A ruleset history service is invoked with a builder object, conventionally called @H@. It has a single method:

h3(function). changeRules(date, ruleBuilder)

Declares that the rules changed on the specified date (an XDate object). @ruleBuilder@ is a function that will be called with a single argument, a ruleset builder, conventionally called @R@. The dates MUST increase with each subsequent call to @changeRules@.

The methods of the ruleset builder are:

h3(function). defineInput(name)

Defines that an input date, called @name@, must be provided by the event log as an input to this ruleset.

h3(function). defineCalendar(name, terms)

Defines a calender, with the given @name@, and the specified list of @terms@ as an array of term objects, which must be in ascending date order (eg, the earliest term first). Term objects are created by calling the @makeTerm@ method on the ruleset builder:

h3(function). makeTerm(name, anchors, technicalStart)

Returns a new term object. The term has the given @name@ (eg, "Easter 2020"), and @anchors@ is an object mapping named events within the term (eg @"start"@, @"end"@, @"registration"@) to XDate objects representing those dates in this term. All terms in a calendar should define the same anchors.

@technicalStart@ is an XDate object representing the "technical" start of the term, which is used to assign an arbitrary date to a particular term. Any date on or after the technical start of a term, but not on or after the technical start of a later term, counts as being in that term. If @technicalStart@ is not specified, the earliest date defined in @anchors@ will be used.

h3(function). defineDateRule(name, rule)

Defines a rule to compute the named output date. @rule@ is a function that will be invoked to compute the rule, passed a single argument: the state interface, conventionally called @S@, defined below.

h3(function). addActivity(name, config)

Defines an activity with the specified configuration.

The name must be unique, in this ruleset and in earlier rulesets.

An activity represents some real-world activity, such as a process being completed.

The activity can have a schedule of dates that the system computes, and it can start and stop at arbitrary times that may or may not follow the computed schedule.

The activity's length may be defined purely by the schedule, or the activity may have a specified fixed duration, in which case the final date in the schedule will adapt to how the activity actually progresses in order to enforce that duration.

The system tracks progress through the activity, both in terms of elapsed time and a fraction of the length that has elapsed.

The configuration is an object with a selection of the following keys:

h4. @schedule@

If specified, this gives a defined schedule for this activity, in the form of an array of activity intervals during which the activity is expected to occur. Each interval is a two-element array consisting of two date names, which must either be inputs or date rules in this ruleset - or, if the activity has a defined duration, the final date of the final interval must not be specified as an input or a date rule, as the system will generate a date rule automatically to make the activity have the specified duration.

This option is mutually exclusive with @scheduleFromCalendar@.

h4. @scheduleFromCalendar@

If specified, this makes the system compute a schedule from a specified term calendar. The value must be an object with the following keys.

This option is mutually exclusive with @schedule@.

h5. @calendar@

The name of the calendar to base the schedule on.

h5. @intervals@

An array of intervals within each term during which the activity is schedule to occur. Each interval is represented by a two-element array of anchor names that are defined within the terms of that calendar. The intervals must be non-overlapping and in ascending date order within the terms.

h5. @start@

A date rule function used to specify the start date of the activity. If that date falls within a break between intervals, then the first interval starting after this date, from the named calendar, will be the actual scheduled start date.

h5. @end@

An optional date rule function used to specify the end date of the activity. If that date falls within a break between intervals, then the last interval ending before this date, from the named calendar, will be the actual scheduled end date.

This option is mutually exclusive with @duration@, but one of the two must be specified.

h4. @duration@

A rule function used to specify the duration this activity must have, which will be used to compute an end date. If specified, then one of the following must hold:

1. There must be neither a @schedule@ or a @scheduleFromCalendar@ setting, so the activity has no specified schedule.

2. There is an @schedule@, and the very last date in the schedule is not specified by an @defineInput@ or a @defineDateRule@, as the system will generate itself.

3. There is a @scheduleFromCalendar@ but it does not specify an @end@ date.

The duration returned by the rule function can either be a raw number in milliseconds or a value returned by the @S.durationIn...@ functions.

h4. @initialProgressFraction@

A rule function used to compute the initial progress through this activity, as a fraction. This can be used to convert progress from an activity that is being removed in this ruleset change into progress in the new activity.

Note that this rule is evaluated in the state context from before the new ruleset is installed, so it has full access to the world as seen by the previous ruleset.

This option is mutually exclusive with @initialProgressTime@, and if neither are specified, initial progress will be zero.

h4. @initialProgressTime@

A rule function used to compute the initial progress through this activity, as elapsed time. This can be used to convert progress from an activity that is being removed in this ruleset change into progress in the new activity.

Note that this rule is evaluated in the state context from before the new ruleset is installed, so it has full access to the world as seen by the previous ruleset.

This option is mutually exclusive with @initialProgressFraction@, and if neither are specified, initial progress will be zero.

h4. @transitions@

An object listing the available transitions this activity supports.

Transitions are events that cause the activity to recompute its schedule, which will be required if something has changed that might affect the schedule - such as an input date or a flag.

Named transitions can be defined for each activity, and those transitions can then be triggered in the event log.

Each transition must be named in the @transitions@ object, and the value of the transition must be a transition specification with the following properties, all of which are optional:

h5. @flagsToAdd@

An array of strings, which are flags that will be automatically added to the current flag list when this transition is performed.

h5. @flagsToRemove@

An array of strings, which are flags that will be automatically removed from the current flag list when this transition is performed.

h5(function). newProgressTime(S, args)

A rule function that is invoked, in the state context before the transition, to specify the new progress time of the activity after the transition. @args@ allows arbitrary metadata to be provided when the transition is performed.

This is mutually exclusive with @newProgressFraction@.

h5(function). newProgressFraction(S, args)

A rule function that is invoked, in the state context before the transition, to specify the new progress fraction of the activity after the transition. @args@ allows arbitrary metadata to be provided when the transition is performed.

This is mutually exclusive with @newProgressTime@.

h3(function). removeActivity(name)

Removes an activity defined in an earlier ruleset.

h2. Defining a rule function

As discussed above, in a ruleset definition, @defineDateRule@ is used to define a rule to compute a specific date, and rule functions are also used to define the start/end dates of activities scheduled from calendars, and rules that return non-date objects are used to define the duration or initial progress of an activity. Just to complicate matters, a date rule can also return either a plain date, or a repeating date.

The rule is a function that will be called to compute the desired value, and passed a single argument, an object that allows access to the state of the computation at that point in time, traditionally called @S@.

As a special case to save you from writing functions that just return a constant, any non-function object appearing where a rule function is expected will evaluate to itself.

@S@ has the following methods:

h3. Date operations

h4(function). makeDate(xDate, rationale, inputs)

Returns a rule engine date object, given an input XDate object, an optional rationale, and optional inputs. If no inputs are provided, an empty array of inputs will be present in the returned date object. If no rational is provided, then @"Hardcoded in ruleset"@ will be used as the rationale.

h4(function). addDays(date, days)

Adds @days@ days (which can be negative, to go backwards in time) to a rule engine date object @date@.

h4(function). addWeeks(date, weeks)

Adds @weeks@ weeks (which can be negative, to go backwards in time) to a rule engine date object @date@.

h4(function). addMonths(date, months)

Adds @months@ months (which can be negative, to go backwards in time) to a rule engine date object @date@.

h4(function). addYears(date, years)

Adds @years@ years (which can be negative, to go backwards in time) to a rule engine date object @date@.

h3. Duration constructors

The @duration@ rule function specified when setting up an activity can either return a raw duration in milliseconds or, more helpfully, return the value produced by one of these duration constructors:

h4(function). durationInDays(days)

Returns a duration with the specified length in days.

h4(function). durationInWeeks(weeks)

Returns a duration with the specified length in weeks.

h4(function). durationInMonths(months)

Returns a duration with the specified length in months. Note that, as months vary in length, this only makes sense in situations where the activity has a scheduled start date so the system can compute how long the desired number of months is.

h4(function). durationInYears(years)

Returns a duration with the specified length in years. Note that, as years vary in length, this only makes sense in situations where the activity has a scheduled start date so the system can compute how long the desired number of years is.

h3. Calendar operations

h4(function). getTermName(calendar, term)

Given the name of a calender defined in the current ruleset, and the numerical index of a term (starting at 0), returns the name of that term.

h4(function). getTermDate(calendar, term, anhcor)

Given the name of a calender defined in the current ruleset, the numerical index of a term (starting at 0), and the name of an anchor within that term, returns a system date object representing that anchor in that term.

h4(function). findTermForDate(calendar, date)

Given the name of a calendar defined in the current ruleset, and an engine date object, returns the numerical index of the term that date falls into.

h4(function). findTermDateBefore(calender, date, anchor)

Given the name of a calendar defined in the current ruleset, an engine date object, and the name of an anchor defined within the terms of the calendar, returns an engine date object that is the nearest instance of that anchor in a term that is before or equal to the provided date.

h4(function). findTermDateAfter(calender, date, anchor)

Given the name of a calendar defined in the current ruleset, an engine date object, and the name of an anchor defined within the terms of the calendar, returns an engine date object that is the nearest instance of that anchor in a term that is after or equal to the provided date.

h4(function). advanceTerms(calendar, date, N, endAnchor)

Given the name of a calendar defined in the current ruleset, an engine date object, a number of terms, and optionally the name of an anchor defined within the terms of the calendar (if not specified, it defaults to @"end"@), returns an engine date object that is the value of the specified anchor in the term @N@ terms after the term containing @date@.

h3. Activity operations

h4(function). getActivityProgressTime(name)

Returns the elapsed time (in milliseconds) on the named activity.

h4(function). getActivityProgressFraction(name)

Returns the elapsed progress fraction (from 0 to 1) on the named activity.

h3. Repeating dates

h4(function). makeRepeatingDate(start, interval, unit, end, rationale)

Creates a new repeating date object, with the given start date (as an engine date object), a numerical repeat @interval@ and @unit@ (@"days"@, @"weeks"@, @"months"@ or @"years"@), an optional @end@ engine date object, and an optional @rationale@ string (if not specified, @"Hardcoded in ruleset"@ will be used as a default).

h4(function). isRepeatingDateValid(repeatingDate)

Synonym for @repeatingDate.isValid()@.

h4(function). getRepeatingDateRationale(repeatingDate)

Synonym for @repeatingDate.getRationale()@.

h4(function). getRepeatingDateOccurrence(repeatingDate, index)

Synonym for @repeatingDate.getDate(index)@.

h4(function). mapRepeatingDate(repeatingDate, mapper)

Returns a new repeating date that is generated by taking each occurance of the input @repeatingDate@ and applying the @mapper@ function to it. The mapper function is passed two arguments - @index@ (the index of the occurrence being requested) and @date@ (an engine date object representing the occurrence obtained from @repeatingDate@). It must return a new system date object. Note that @date@ might not be a valid date, if @index@ represents an occurrence of @repeatingDate@ after the end date or if @repeatingDate@ is not valid, so the mapper function must take care to not behave incorrectly in that case. For instance:

<pre>
var delayedRepeatingDate = S.mapRepeatingDate(repeatingDate, function(index, date) {
   if (date.xdate) {
       return I.makeDate(date.xdate.addDays(1), [date], "Added 1 day");
   } else {
       return date;
   }
});
</pre>

h4(function). fitRepeatingDateWithinActivity(repeatingDate, activity, exclusionKind)

Returns a repeating date based on @repeatingDate@, but with any occurrences that do not fit within scheduled intervals of the activity called @activity@ excluded as per @exclusionKind@.

Valid @exclusionKind@ values are:

1. @"skip"@: Excluded occurrences are just skipped.

2. @"dayBefore"@: Any number of excluded occurrences in the same break in the activity schedule are replaced with a single occurrence, on the last day of the previous scheduled activity interval.

2. @"dayAfter"@: Any number of excluded occurrences in the same break in the activity schedule are replaced with a single occurrence, on the first day of the next scheduled activity interval.

h4(function). fitRepeatingDateWithinCalendar(repeatingDate, calendar, intervals, exclusionKind)

Returns a repeating date based on @repeatingDate@, but with any occurrences that do not fit within activity @intervals@ from the named @calendar@ excluded as per @exclusionKind@.

The @intervals@ are an array of intervals, each of which is a two-element array containing the names of anchors that must be present within the terms of @calendar@. They represent intervals of time within the terms during which the repeating date's occurrences are permitted. They must not overlap and they must be in order of increasing date (eg, the earliest ones first).

The @exclusionKind@ options are the same as for @fitRepeatingDateWithinActivity@.

h3. Other state Access

h4(function). getDate(name)

Returns the current value of the named date. This might be an input date defined in the ruleset via @defineInput@ and specified in the event log, a date rule defined in the ruleset via @defineDateRule@, or an automatically-computed activity schedule date created as the final date of an activity with a defined duration, or any of the dates generated as part of an activity's schedule created from a calendar.

h4(function). hasFlag(name)

Returns true if and only if the named flag is currently set, as specified in the event log.

h2. Defining an event log

An event log is the input to the @haplo:date_rule_engine_2:compute_dates@ service that provides the inputs to the rules, so that they can compute the output dates.

It is a series of timestamped events. Multiple events may have the same timestamp, but the event log MUST be presented in ascending order - with the earliest events first.

Event log entries all have a timestamp in a @when@ property, and a type code in a @type@ property, and otherwise may be in the following forms:

h3. @{"when": xdate, "type": "flags", "flags": flags}@

Updates the current list of set flags to @flags@, an array of strings. The @S.hasFlag(name)@ function will return true iff the currently active list of set flags contains @name@.

h3. @{"when": xdate, "type": "addFlags", "flags": flags}@

Updates the current list of set flags to include every element in @flags@, an array of strings, while keeping any flags from the current list of set flags. The @S.hasFlag(name)@ function will return true iff the currently active list of set flags contains @name@.

h3. @{"when": xdate, "type": "removeFlags", "flags": flags}@

Updates the current list of set flags to NOT include any element in @flags@, an array of strings, while keeping any flags from the current list of set flags that are not in @flags@. The @S.hasFlag(name)@ function will return true iff the currently active list of set flags contains @name@.

h3. @{"when": xdate, "type": "activityTransition", "activity": activity, "transition": transition, ...}@

Performs the specified @transition@ of the specified @activity@. The log entry is passed to rule functions defined in the transition as the additional @args@ parameter, so arbitrary additional data can be added to the log entry and made available to the transition functions.

The effect of this is to evaluate any @newProgressTime@ or @newProgressFraction@ rule functions to compute the new progress for the activity, then to add and remove any flags specified in the transition definition, then to recompute the duration and schedule of the activity with the new state.

h3. @{"when": xdate, "type": "forceProgress", "activity": activity, "progressFraction": progress}@

Forces the current progress level of activity @activity@ to @progress@ as a fraction (from 0 to 1).

h3. @{"when": xdate, "type": "forceProgress", "activity": activity, "progressTime": progress}@

Forces the current progress level of activity @activity@ to @progress@ as an elapsed time interval (in milliseconds).

h3. @{"when": xdate, "type": "unscheduledStart", "activity": activity}@

Records that the activity named @activity@ started at this point in time, but
this wasn't specified in the schedule.

h3. @{"when": xdate, "type": "unscheduledStart"}@

Records that all activities defined in the current ruleset, that weren't already in progress, started at this point in time, but this wasn't specified in their schedules.

h3. @{"when": xdate, "type": "unscheduledStart", "except": except}@

Records that all activities defined in the current ruleset apart those whose names are in the array @except@, that weren't already in progress, started at this point in time, but this wasn't specified in their schedules.

h3. @{"when": xdate, "type": "unscheduledStop", "activity": activity}@

Records that the activity named @activity@ stopped at this point in time, but
this wasn't specified in the schedule.

h3. @{"when": xdate, "type": "unscheduledStop"}@

Records that all activities defined in the current ruleset, that were currently in progress, stopped at this point in time, but this wasn't specified in their schedules.

h3. @{"when": xdate, "type": "unscheduledStop", "except": except}@

Records that all activities defined in the current ruleset apart those whose names are in the array @except@, that were currently in progress, stopped at this point in time, but this wasn't specified in their schedules.

h3. @{"when": xdate, "type": "setDate", "name": name, "date": date}@

Records that the named date is equal to the XDate object in @date@. This may be used to specify an input date defined in the ruleset via @defineInput@, or it may be used to override a computed date from a @defineDateRule@, or generated as part of an activity schedule. If the date is part of one or more activity's schedules, this can be used to override the schedule - for instance, if an interval of work on an activity is started late, a @setDate@ event in the log BEFORE the scheduled start date can be used to set that scheduled date a few days later.

Because of this requirement, it is perfectly valid to place all overrides of dates right at the start of the event log, at some ficticious point in the past.

Note that the @"when"@ property is the XDate when this change takes effect in the event log; the @"date"@ property is the date we are declaring the named date is equal to.
