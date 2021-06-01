title: Time zones
module_owner: Rachel Zarrouk
--

This plugin provides functionality for converting dates between timezones and scheduling actions in different timezones reliably.

Time is not our friend.

e.g.

NZDT _might_ put some parts of New Zealand at UTC+13 hours, also _maybe_ at UTC+12.

So if the time difference is UTC+13, midnight would therefore be at 11:00 the _day before_ in UTC.

At other times of year, the same part of NZ could be +11 hours, so midnight would therefore be at 13:00 the _day before_ in UTC.

In this sense we have to care more about *time*, in order to ensure we are talking about the correct date.

Confusing? Annoying? Fine, but ugh? Use these services.


h2. Services

*NB: ALL OUTPUTS ARE NATIVE JS DATES.*

h3(service). "haplo:time-zones:get-local-today"

<pre>language=javascript
    O.service("haplo:time-zones:get-local-today");
</pre>

Has the optional argument @timezone@, * and returns the cleartimed date in the relevant timezone.

*as described in the table below, ommitting the timezone argument, it defaults to that of Group. Everyone.

e.g. Could be used when checking how many calendar days have passed. 

*Examples!*

If we take the timezone of Group .Everyone to be NZT and the current date as the 7th of May.

NB: Inputs/outputs made readable - refer to the argument table below for types.

| *Current datetime*  | <center>*Input*</center>    | *Output*      | *Description*         |
| 7th May 09:30 (UTC) | <center>_none_</center>     | 7th May 00:00 | Current date in NZ    |
| 7th May 13:30 (UTC) | <center>_none_</center>     | 8th May 00:00 | Current date in NZ    |
|       -             |   -<center>-</center>       |       -       |           -           |
| 7th May 09:30 (UTC) | O.timeZone("Europe/London") | 7th May 00:00 | Current date in UK    |
| 7th May 13:30 (UTC) | O.timeZone("Europe/London") | 7th May 00:00 | Current date in UK    |

------

h3. *Arguments:*

The arguments for both @"haplo:time-zones:get-local-datetime-from-utc"@ and @"haplo:time-zones:get-utc-equivalent-from-local-datetime"@ are the same.

You will likely only need to use the first three arguments:
- the input @date@
- @hours@ and @minutes@ to adjust the @date@, before conversion

The full list of arguments are as follows:

| *Arg*             | *Description*                                                                                             | *default*                                                             |
| @date@            | a JS date object, e.g. new Date() or new <a href=https://arshaw.com/xdate/> XDate</a>()                   | new XDate()                                                           |
| @hours@           | an integer between (incl.) 0 and 23 (can be overriden with the @allowOverflow@ property)                  | @date@ 's time is used (TXX:XX:XX.XXXZ)                               |
| @minutes@         | an integer between (incl.) 0 and 59 (can be overriden with the @allowOverflow@ property)                  | @date@ 's time is used (TXX:XX:XX.XXXZ)                               |
| @timezone@        | a <a href=https://docs.haplo.org/plugin/interface/time-zone> Timezone interface</a> object                | the timezone of Group. Everyone which can be set in System Management |
| @allowOverflow@   | a boolean, setting this to true allows for numerical inputs outside of the above ranges, e.g. 120 hours   | undefined -> false                                                    |

-----

h3(service). "haplo:time-zones:get-local-datetime-from-utc"

<pre>language=javascript
    O.service("haplo:time-zones:get-local-datetime-from-utc", date, hours, minutes, timezone, allowOverflow);
</pre>

Offsets a given datetime (assumes UTC) based on @timezone@ - returns the local datetime as a JS Date object.

*Examples!*

If we take the timezone of Group .Everyone to be New Zealand Daylight Time (NZDT) and the current date as the 7th of May.

NB: datetimes made readable, refer to the argument table above for types. 

| *Current datetime*  | <center>*Inputs*</center>                               | *Output*                  | *Description*                             |
| 7th May 09:30 (UTC) | <center>_none_</center>                                 | 7th May 21:30             | Current datetime in NZ.                   |
| 7th May 13:30 (UTC) | <center>_none_</center>                                 | 8th May 01:30             | Current datetime in NZ.                   |
|       -             |         -<center>-</center>                             |           -               |                 -                         |
| 7th May 09:30 (UTC) | XDate.today()                                           | 7th May 12:00             | The datetime in NZ at midnight UTC.       |
| 7th May 09:30 (UTC) | new XDate().clearTime()                                 | 7th May 12:00             | The datetime in NZ at midnight UTC.       |
|       -             |         -                                               |           -               |                 -                         |
| 7th May 09:30 (UTC) | null, null, null, O.timeZone("Europe/London")     | 7th May 10:30             | Current datetime in Europe/UK.            |
| 7th May 09:30 (UTC) | new Date(), 13, 30, O.timeZone("Europe/London")         | 7th May 14:30             | The datetime in Europe/UK at 13:30 UTC.   |


h3(service). "haplo:time-zones:get-utc-equivalent-from-local-datetime"

<pre>language=javascript
    O.service("haplo:time-zones:get-utc-equivalent-from-local-datetime", date, hours, minutes, timezone, allowOverflow);
</pre>

Offsets a given datetime based on timezone - returns the UTC equivalent of the input as a JS Date object. 

*Examples!*

If we take the timezone of Group .Everyone to be New Zealand Daylight Time (NZDT) and the current date as the 7th of May.

NB: datetimes made readable, refer to the argument table above for types. 

| *Current datetime*  | <center>*Inputs*</center>                               | *Output*                  | *Description*                                                 |
| 7th May 09:30 (UTC) | <center>_none_</center>                                 | 6th May 21:30             | The UTC equivalent of current datetime in NZ.                 |
| 7th May 13:30 (UTC) | <center>_none_</center>                                 | 7th May 01:30             | The UTC equivalent of current datetime in NZ.                 |
|       -             |         -<center>-</center>                             |           -               |                 -                                             |
| 7th May 09:30 (UTC) | XDate.today()                                           | 6th May 12:00             | The UTC equivalent of midnight in NZ for the current date.    |
| 7th May 09:30 (UTC) | new XDate().clearTime()                                 | 6th May 12:00             | The UTC equivalent of midnight in NZ for the current date.    |
|       -             |         -<center>-</center>                             |           -               |                 -                                             |
| 7th May 09:30 (UTC) | null, null, null, O.timeZone("Europe/London")           | 7th May 08:30             | Current datetime in Europe/UK.                                |
| 7th May 09:30 (UTC) | new Date(), 13, 30, O.timeZone("Europe/London")         | 7th May 12:30             | The datetime in Europe/UK at 13:30 UTC.                       |



h3. *Use cases:*

- To input the current datetime omit all arguments.

- To input the midnight/clearTime equivalent pass in the cleartimed @date@.

*_It is important to know the difference between these two services._*

-----

-----

*Ommitting arguments*


Current local datetime:

<pre>language=javascript
    O.service("haplo:time-zones:get-local-datetime-from-utc");
</pre>
e.g. for use with date formatting to display a date in the user timezone/check consistency

-----

Current time's UTC equivalent relative to timezone (probably not that useful): 

<pre>language=javascript
    O.service("haplo:time-zones:get-utc-equivalent-from-local-datetime");
</pre>

-----

*Cleartiming/Setting hours and minutes*


Local midnight equivalent: 

<pre>language=javascript
    O.service("haplo:time-zones:get-local-today");
</pre>

e.g. the current date in local timezone/the point at which it changes

e.g counting calendar days since

-----

Midnight UTC at local time:

<pre>language=javascript
    //either
    O.service("haplo:time-zones:get-utc-equivalent-from-local-datetime", someXDate.clearTime());
</pre>
e.g. if +13 hours UTC then up to 1pm, in that timezone, our system would still count the current date as the day before.

-----
-----

h2. Scheduler

Our standard scheduing hooks use UTC time, so when we have clients in different time zones we are likely scheduling things at inappropriate times.

Testing scheduled actions can also be a pain, with the discover-scheduled-tasks service (below) implemented, you can go to `/do/haplo-time-zones/test-scheduled` to test your scheduled tasks (as a super user).

h3(service). "haplo:time-zone:discover-scheduled-tasks"

In order to schedule Things at local time this service should be used to replace normal hooks e.g. <a href=https://docs.haplo.org/plugin/hook/schedule-daily-early >hScheduleDailyEarly</a>

<pre>language=javascript
    P.implementService("haplo:time-zone:discover-scheduled-tasks", function(tasks) {
        tasks.schedule({
        hourOrSchedulerHook: 9, // 9am in target timezone
        task(response, year, month, dayOfMonth, hour, dayOfWeek) {
            //Things to Do
            //date unit args in local timezone unless setTaskArgumentsToUTC property is set to true
        }
    });});
</pre>

*NB: By default the task arguments (which mimic the inputs for scheduler hooks) will be at local time.*

-------

h3. *Arguments:*

**REQUIRED** a function, as above with one argument, tasks, to schedule tasks you must use the @schedule@ property, containing an object with at least hourOrScheduleHook & task 

Useful properties:

- hourOrSchedulerHook - the hour (0-23) at local time you'd like your task to be run OR a defined hook type. e.g. "hScheduleDailyEarly" is the equivalent to calling the hook at 6am

- kind (for better error logging)

- task - function called to Do The Thing at whatever time necessary, arguments are as per usual hooks, (response, year, month, dayOfMonth, hour, dayOfWeek) 

- setTaskArgumentsToUTC - bool, set this to true for task argument date units to be passed in in UTC, i.e. the time in UTC at which the hook was called as opposed to local time, which is default  e.g. if you have set the hourOrSchedulerHook to 0 or used 'hScheduleDailyMidnight' without using  setTaskArgumentsToUTC then the task's hour argument should be zero.

- date - only needed to run on a certain date

--------

The full list of properties are as follows:

| *Property*                            | *Type*                                                            | *Description*                                     | *default*                                                             |
| @hourOrSchedulerHook@  -  *required*  | integer (0-23) OR string, i.e. predefined hook type (see below)   | when the hook should be run                       | undefined -> false                                                    |
| @task@  -  *required*                 | function with arguments mimicing those listed here: <a href=https://docs.haplo.org/plugin/hook/schedule-daily-early >hScheduleDailyEarly</a>   | tasks to be run at scheduled time (by default argument inputs are in local time)                      | undefined -> false                                                    |
| @kind@  -  _recommended_              | string                                                            | a string description in the standard kind format for more useful error logging, e.g. plugin:description. ":time-zones-scheduler" will be appended   | undefined:time-zones-scheduler" |
| @setTaskArgumentsToUTC@               | boolean                                                           | set this to true for task argument date units to be passed in in UTC, i.e. the time in UTC at which the hook was called as opposed to local time, which is default | undefined -> false |
| @callRelativeToUTC@                   | boolean                                                           | set to true to 'ignore' hourOrScheduler to call the hook at UTC time, i.e. act like a normal hook | undefined -> false |
| @date@                                | a JS date object, e.g. new Date() or new <a href=https://arshaw.com/xdate/> XDate</a>()       | a specific date this action should be run on      | new XDate()                                                           |
| @timezone@                            | a <a href=https://docs.haplo.org/plugin/interface/time-zone> Timezone interface</a> object    | @timezone@                                        | the timezone of Group. Everyone which can be set in System Management |


Avaliable hook types vs. the hour they're typically called at in UTC:
- hScheduleDailyEarly: 6
- hScheduleDailyLate: 18
- hScheduleDailyMidday: 12
- hScheduleDailyMidnight: 0
- hScheduleHourly: null

-----

h3. *Testing:*

You can go to `/do/haplo-time-zones/test-scheduled` to test your scheduled tasks via the form.

The schedulers will always be called at UTC time, if you state that your input date is not in UTC, the date/hour will be converted from local to UTC time.

e.g.

In winter time, 11am UTC in Auckland is midnight.

To test at midnight for the 5th of December:

If Yes selected for 'Date in UTC', your Test Date should be 4th of December, and your Test hour should be 11.
If No is selected for 'Date in UTC', your Test Date should be 5th of December, and your Test hour should be 0.


*/
