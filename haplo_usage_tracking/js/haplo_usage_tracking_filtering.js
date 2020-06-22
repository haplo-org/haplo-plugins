/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

P.data.migrated = 0;
P.data.robots = 0;
P.data.seen = 0;
P.data.migrationStarted = false;

var requestIsDuplicate = P.requestIsDuplicate = function(userAgent, object, kind, datetime, ip) {
    let thirtySecondsAgo = new XDate(datetime).addSeconds(-30);
    let countOfRecentEvents = P.db.events.select().
                                where("userAgent", "=", userAgent).
                                where("kind", "=", kind).
                                where("object", "=", object || null).
                                where("datetime", ">=", thirtySecondsAgo.toDate()).
                                where("datetime", "<", new Date(datetime)).
                                where("remoteAddress", "=", ip).
                                count();
    return countOfRecentEvents > 0;
};

var userAgentIsRobot = P.userAgentIsRobot = function(userAgent) {
    let regex = new RegExp(ROBOTS_LIST.join("|"), "i");
    return regex.test(userAgent);
};

P.hook("hScheduleDailyEarly", function(response, year, month, dayOfMonth) {
    if(dayOfMonth === 1) {
        let monthAgo = new XDate().addMonths(-1);
        let robotsEvents = P.db.events.select().where("classification", "=", 1).where("datetime", "<", monthAgo).deleteAll();
    }
});

//List taken from https://github.com/atmire/COUNTER-Robots
var ROBOTS_LIST = [
    "bot",
    "^Buck\\/[0-9]",
    "spider",
    "crawl",
    "^.?$",
    "[^a]fish",
    "^IDA$",
    "^ruby$",
    "^@ozilla\\/\\d",
    "^脝脝陆芒潞贸碌脛$",
    "^破解后的$",
    "AddThis",
    "A6-Indexer",
    "ADmantX",
    "alexa",
    "Alexandria(\\s|\\+)prototype(\\s|\\+)project",
    "AllenTrack",
    "almaden",
    "appie",
    "API[\\+\\s]scraper",
    "Arachni",
    "Arachmo",
    "architext",
    "ArchiveTeam",
    "aria2\\/\\d",
    "arks",
    "^Array$",
    "asterias",
    "atomz",
    "BDFetch",
    "Betsie",
    "baidu",
    "biglotron",
    "BingPreview",
    "binlar",
    "bjaaland",
    "Blackboard[\\+\\s]Safeassign",
    "blaiz-bee",
    "bloglines",
    "blogpulse",
    "boitho\\.com-dc",
    "bookmark-manager",
    "Brutus\\/AET",
    "BUbiNG",
    "bwh3_user_agent",
    "CakePHP",
    "celestial",
    "cfnetwork",
    "checklink",
    "checkprivacy",
    "China\\sLocal\\sBrowse\\s2\\.6",
    "cloakDetect",
    "coccoc\\/1\\.0",
    "Code\\sSample\\sWeb\\sClient",
    "ColdFusion",
    "collection@infegy.com",
    "com\\.plumanalytics",
    "combine",
    "contentmatch",
    "ContentSmartz",
    "convera",
    "core",
    "Cortana",
    "CoverScout",
    "curl\\/",
    "cursor",
    "custo",
    "DataCha0s\\/2\\.0",
    "daumoa",
    "^\\%?default\\%?$",
    "DeuSu\\/",
    "Dispatch\\/\\d",
    "Docoloc",
    "docomo",
    "Download\\+Master",
    "DSurf",
    "DTS Agent",
    "EasyBib[\\+\\s]AutoCite[\\+\\s]",
    "easydl",
    "EBSCO\\sEJS\\sContent\\sServer",
    "ELinks\\/",
    "EmailSiphon",
    "EmailWolf",
    "Embedly",
    "EThOS\\+\\(British\\+Library\\)",
    "facebookexternalhit\\/",
    "favorg",
    "FDM(\\s|\\+)\\d",
    "Feedbin",
    "feedburner",
    "FeedFetcher",
    "feedreader",
    "ferret",
    "Fetch(\\s|\\+)API(\\s|\\+)Request",
    "findlinks",
    "findthatfile",
    "^FileDown$",
    "^Filter$",
    "^firefox$",
    "^FOCA",
    "Fulltext",
    "Funnelback",
    "Genieo",
    "GetRight",
    "geturl",
    "G-i-g-a-b-o-t",
    "GLMSLinkAnalysis",
    "Goldfire(\\s|\\+)Server",
    "google",
    "Grammarly",
    "grub",
    "gulliver",
    "gvfs\\/",
    "harvest",
    "heritrix",
    "holmes",
    "htdig",
    "htmlparser",
    "HttpComponents\\/1.1",
    "HTTPFetcher",
    "http.?client",
    "httpget",
    "httrack",
    "ia_archiver",
    "ichiro",
    "iktomi",
    "ilse",
    "Indy Library",
    "^integrity\\/\\d",
    "internetseer",
    "intute",
    "iSiloX",
    "iskanie",
    "^java\\/\\d{1,2}.\\d",
    "jeeves",
    "Jersey\\/\\d",
    "jobo",
    "kyluka",
    "larbin",
    "libcurl",
    "libhttp",
    "libwww",
    "lilina",
    "^LinkAnalyser",
    "link.?check",
    "LinkLint-checkonly",
    "^LinkParser\\/",
    "^LinkSaver\\/",
    "linkscan",
    "LinkTiger",
    "linkwalker",
    "lipperhey",
    "livejournal\\.com",
    "LOCKSS",
    "LongURL.API",
    "ltx71",
    "lwp",
    "lycos[_+]",
    "mail.ru",
    "MarcEdit",
    "mediapartners-google",
    "megite",
    "MetaURI[\\+\\s]API\\/\\d\\.\\d",
    "Microsoft(\\s|\\+)URL(\\s|\\+)Control",
    "Microsoft Office Existence Discovery",
    "Microsoft Office Protocol Discovery",
    "Microsoft-WebDAV-MiniRedir",
    "mimas",
    "mnogosearch",
    "moget",
    "motor",
    "^Mozilla$",
    "^Mozilla.4\\.0$",
    "^Mozilla\\/4\\.0\\+\\(compatible;\\)$",
    "^Mozilla\\/4\\.0\\+\\(compatible;\\+ICS\\)$",
    "^Mozilla\\/4\\.5\\+\\[en]\\+\\(Win98;\\+I\\)$",
    "^Mozilla.5\\.0$",
    "^Mozilla\\/5.0\\+\\(compatible;\\+MSIE\\+6\\.0;\\+Windows\\+NT\\+5\\.0\\)$",
    "^Mozilla\\/5\\.0\\+like\\+Gecko$",
    "^Mozilla\\/5.0(\\s|\\+)Gecko\\/20100115(\\s|\\+)Firefox\\/3.6$",
    "^MSIE",
    "MuscatFerre",
    "myweb",
    "nagios",
    "^NetAnts\\/\\d",
    "netcraft",
    "netluchs",
    "ng\\/2\\.",
    "^Ning\\/\\d",
    "no_user_agent",
    "nomad",
    "nutch",
    "^oaDOI$",
    "ocelli",
    "Offline(\\s|\\+)Navigator",
    "^okhttp$",
    "onetszukaj",
    "^Opera\\/4$",
    "OurBrowser",
    "panscient",
    "parsijoo",
    "Pcore-HTTP",
    "pear.php.net",
    "perman",
    "PHP\\/",
    "pidcheck",
    "pioneer",
    "playmusic\\.com",
    "playstarmusic\\.com",
    "^Postgenomic(\\s|\\+)v2",
    "powermarks",
    "proximic",
    "PycURL",
    "python",
    "Qwantify",
    "rambler",
    "ReactorNetty\\/\\d",
    "Readpaper",
    "redalert",
    "Riddler",
    "robozilla",
    "rss",
    "scan4mail",
    "scientificcommons",
    "scirus",
    "scooter",
    "Scrapy\\/\\d",
    "ScoutJet",
    "^scrutiny\\/\\d",
    "SearchBloxIntra",
    "shoutcast",
    "SkypeUriPreview",
    "slurp",
    "sogou",
    "speedy",
    "Strider",
    "summify",
    "sunrise",
    "Sysomos",
    "T\\-H\\-U\\-N\\-D\\-E\\-R\\-S\\-T\\-O\\-N\\-E",
    "tailrank",
    "Teleport(\\s|\\+)Pro",
    "Teoma",
    "The\\+Knowledge\\+AI",
    "titan",
    "^Traackr\\.com$",
    "Trove",
    "twiceler",
    "ucsd",
    "ultraseek",
    "^undefined$",
    "^unknown$",
    "Unpaywall",
    "URL2File",
    "urlaliasbuilder",
    "urllib",
    "^user.?agent$",
    "^User-Agent",
    "validator",
    "virus.detector",
    "voila",
    "^voltron$",
    "voyager\\/",
    "w3af.org",
    "Wanadoo",
    "Web(\\s|\\+)Downloader",
    "WebCloner",
    "webcollage",
    "WebCopier",
    "Webinator",
    "weblayers",
    "Webmetrics",
    "webmirror",
    "webmon",
    "weborama-fetcher",
    "webreaper",
    "WebStripper",
    "WebZIP",
    "Wget",
    "wordpress",
    "worm",
    "www\\.gnip\\.com",
    "WWW-Mechanize",
    "xenu",
    "y!j",
    "yacy",
    "yahoo",
    "yandex",
    "Yeti\\/\\d",
    "zeus",
    "zyborg"
];
