/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*HaploDoc
node: haplo_icalendar_support
title: iCalendar exporter
--

Usage: get a @CalendarExporter@ object by calling

<pre>language=javascript
O.service("haplo_icalendar_support:exporter", {
   title: "Title",
   events: [{}, {}, ...]
});
</pre>

Spec properties:

* title (optional): Sets X-WR-CALNAME and used for default filename
* events (optional): A list of "event" objects that require certain properties

Event properties:

NOTE: a minimum event definition has a kind, id, title, and start 

| kind | string | required | internal string denoting the 'kind' of event, used for uid's |
| id | string-able | required | unique identifying id that must be toString-able, *MUST* be unique \
for the 'kind' of object on a given application \
for events related to objects, passing a ref is recommended |
| title | string | required | the event text to be displayed in the users calendar \
'summary' is the ical name for this, and can be used as an alias of title |
| description | string | optional | longer description of the event |
| location | string | optional | loction where the event will take place |
| status | string | optional | One of: "CONFIRMED", "TENTATIVE", "CANCELLED" \
defaults to "CONFIRMED" if not set |
| start | Date | required | when the calendar event should begin |
| end | Date | optional | when the calendar event should end |
| created | Date | optional | when the event was created  |
| lastModified | Date | optional | when the event was last updated or changed |
| categories | [string] | optional | array of strings that represent categories the event is under |

@CalendarExporter@ properties:

* toString() - returns ics formatted calendar as string
* toBinaryData(filename) - returns a binaryData object with optional filename specification
* respondWithDownload(E, filename) - shortcut to respond with a .ics file (filename optional) \
calls toBinaryData() and sets the response body
* addEvent(event) - add an event to the events list. you likely won't need to use this

Limitations/Notes:

* repeat events are not supported
* "all day" events are not supported

*/

// Helper functions for building event strings

var makeUniqueIdentifier = function(event) {
    // uid *must* be unique and consistently reproducable.
    // can be a Ref
    // made up of uid + kind + @ + hostname
    var uid;
    if(event.id) {
        if(O.isRef(event.id)) {
            uid = event.id.toString();
        } else {
            uid = event.id;
        }
    } else {
        throw new Error("Event passed to ICS exporter without id");
    }
    // should undefined event.kind throw an exception?
    return uid + (event.kind ? "/"+event.kind : "") + "@" + O.application.hostname;
};
var convertDateToDTString = function(date, timezone) {
    // TODO: 'all day' events and general precision awareness, currently only supports
    // setting timestamps
    // TODO: timezone support - #PHD-1682
    // - currently converts a date object to UTC unless 'localtime' is timezone param
    //   in which case it makes an event with no tz information, which
    //   renders in the users local time
    if(!date) { throw new Error("No date passed to DTString converter"); }
    date = new XDate(date);
    // 19970714T133000 + Z for UTC
    var dtstring;
    if(!timezone || timezone === "UTC") {
        dtstring = date.toUTCString("yyyyMMdd'T'HHmmss'Z'"); 
    } else if(timezone === "localtime") { // floating: http://www.kanzaki.com/docs/ical/dateTime.html
        dtstring = date.toString("yyyyMMdd'T'HHmmss"); 
    }
    return dtstring;
};
var escapeTextProperty = function(text) {
    var str;
    if(O.isText(text)) { str = text.toString(); } // TODO: what if it is rich text/XML doc
    else { str = text; }
    return str.replace(/\\/g, "\\\\").
        replace(/\,/g, "\\,").
        replace(/\;/g, "\\;");
};

// -------------------------------------------------------------------------------------------------------

var buildEventString = function(event) {
    var DTSTAMP = new XDate().toUTCString("yyyyMMdd'T'HHmmss'Z'");
    var output = [];
    output.push(
        "BEGIN:VEVENT",
        "CLASS:PUBLIC",
        "SUMMARY:" + escapeTextProperty(event.title || event.summary),
        "STATUS:" + (event.status || "CONFIRMED"), // should check this value if it iused
        "UID:" + makeUniqueIdentifier(event),
        "DTSTAMP:" + DTSTAMP
    );
    output.push("DTSTART:" + convertDateToDTString(event.start, event.timezone));
    if(event.end) { output.push("DTEND:" + convertDateToDTString(event.end, event.timezone)); }
    if(event.created) { output.push("CREATED:" + convertDateToDTString(event.created)); }
    if(event.lastModified) { output.push("LASTMODIFIED:" + convertDateToDTString(event.lastModified)); }
    if(event.location) { output.push("LOCATION:" + escapeTextProperty(event.location)); }
    if(event.description) { output.push("DESCRIPTION:" + escapeTextProperty(event.description)); }
    if(event.categories) { 
        var categories = _.map(event.categories, function(cat) {
            return escapeTextProperty(cat);
        });
        output.push("CATEGORIES:" + categories.join(","));
    }
    // potentially not well supported, ignore?
    // if(event.url) { output.push("URL:" + event.url); }
    output.push(
        "TRANSP:TRANSPARENT",
        "END:VEVENT"
    );
    var eventString = _.reduce(output, function(memo, line) {
        if(line.length > 74) { 
            // icalendar spec restricts line length to 75, so must split long fields over multiple lines
            var split = line.match(/(.|[\r\n]){1,74}/g); // split string into segments of 74 chars length
            // and each of these lines must start with an empty space
            line = split.join("\r\n ");
        }
        return (memo + "\r\n" + line);
    });
    return eventString;
};

// -------------------------------------------------------------------------------------------------------

var CalendarExporter = function(spec) {
    if(spec.title) { this.title = spec.title; }
    this._events = spec.events;
};

CalendarExporter.prototype.__defineGetter__("_header", function() {
    var header = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Haplo Services//Haplo//EN",
        "CALSCALE:GREGORIAN"
    ];
    // TODO: enforce respect ical line char limit
    if(this.title) { header.push("X-WR-CALNAME:"+this.title); }
    return header;
});
CalendarExporter.prototype.__defineGetter__("_footer", function() {
    return ["END:VCALENDAR"];
});

CalendarExporter.prototype.addEvent = function(event) {
    this._events.push(event);
};

CalendarExporter.prototype._buildCalendarString = function() {
    var events = this._events;
    var header = this._header.join("\r\n");
    var footer = this._footer.join("\r\n");
    var eventStrings = [];
    _.each(events, function(event) {
        eventStrings.push(buildEventString(event));
    });
    return [header, eventStrings.join("\r\n"), footer].join("\r\n");
};
CalendarExporter.prototype.toString = function() { return this._buildCalendarString(); };

CalendarExporter.prototype.toBinaryData = function(filename) {
    if(!filename && this.title) {
        filename = encodeURIComponent(this.title.replace(/ /g,"_"))+".ics";
    } else {
        filename = "Calendar.ics"; // default
    }
    return O.binaryData(this.toString(), {
        filename: filename,
        mimeType: "text/calendar"
    });
};

CalendarExporter.prototype.respondWithDownload = function(E, filename) {
    E.response.body = this.toBinaryData(filename);
};

P.implementService("haplo_icalendar_support:exporter", function(spec) {    
    if(_.isArray(spec)) { spec = {events: [spec.events]}; }
    return new CalendarExporter(spec);
});
