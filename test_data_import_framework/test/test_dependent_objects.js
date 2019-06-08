/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


t.test(function() {

    // Test cases:
    // - Person exists, book is created
    // - Person exsits, book exists and is updated with extra notes and title
    // - Create new person and book
    // - Person exists, book exists, and a new book is created

    let makePersonAndBook = function(personName, bookTitle, bookNotes) {
        let person = O.object();
        person.appendType(TYPE["std:type:person"]);
        person.appendTitle(personName);
        person.save();
        let book;
        if(bookTitle) {
            book = O.object();
            book.appendType(TYPE["std:type:book"]);
            book.appendTitle(bookTitle);
            book.append(person, ATTR["dc:attribute:author"]);
            if(bookNotes) {
                book.append(bookNotes, ATTR["std:attribute:notes"]);
            }
            book.save();
        }
        return [person, book];
    };

    let [p0, b0] = makePersonAndBook("Joe");
    let [p1, b1] = makePersonAndBook("Jane", "Jane's Wonderful Book", "Nice book");
    let [p3, b3] = makePersonAndBook("Jack", "Some Thoughts");
    t.assert(!b0);

    // ----------------------------------------------------------------------

    let input = [
        {
            personRef: p0.ref.toString(),
            bookTitle: "Book 0",
            bookNotes: "Notes 0"
        },
        {
            personRef: p1.ref.toString(),
            bookTitle: "Jane's Really Wonderful Book",
            bookNotes: "Notes One"
        },
        {
            name: "John",
            bookTitle: "John's Book",
            bookNotes: "Notes Two"
        },
        {
            personRef: p3.ref.toString(),
            makeNewBook: true,
            bookTitle: "More Thoughts",
            bookNotes: "Notes on Thoughts"
        }
    ];
    let inputFile = O.file(O.binaryData(JSON.stringify(input)));

    // ----------------------------------------------------------------------

    // Control file for import
    let control = {
        "dataImportControlFileVersion": 0,
        "model": "test:one",
        "files": {
            "DEFAULT": {"read": "json"}
        },
        "instructions": [
            // Load person, or create a new one
            {
                "source": "personRef",
                "destination": "load:by-ref",
                "name": "ref",
                "filters": ["haplo:string-to-ref"]
            },
            {
                "action": "load",
                "destination": "profile",
                "using": "load:by-ref",
                "otherwise": [
                    {
                        "action": "new",
                        "destination": "profile"
                    },
                    {
                        "source": "name",
                        "destination": "profile",
                        "name": "dc:attribute:title"
                    }
                ]
            },
            // Make a new book?
            {
                "source": "makeNewBook",
                "action": "if-value-one-of",
                "values": [true],
                "then": [
                    {
                        "action": "new",
                        "destination": "book"
                    }
                ]
            },
            // Update title?
            {
                "source": "bookTitle",
                "action": "if-exists",
                "then": [
                    {
                        "action": "remove-values",
                        "destination": "book",
                        "name": "dc:attribute:title"
                    },
                    {
                        "source": "bookTitle",
                        "destination": "book",
                        "name": "dc:attribute:title"
                    }
                ]
            },
            // Add any notes
            {
                "source": "bookNotes",
                "destination": "book",
                "name": "std:attribute:notes",
                "multivalue": true
            }
        ]
    };

    // ----------------------------------------------------------------------

    let errors = [];
    let batch = O.service("haplo:data-import-framework:batch", control, {input:inputFile}, (e,r)=>errors.push([e,r]));

    let created = [];
    batch.observe("object:save", (transformation, destinationName, object, isNewObject) => {
        created.push([destinationName, object, isNewObject]);
    });

    batch.eachRecord((record) => {
        let transformation = batch.transform(record);
        if(transformation.isComplete) {
            transformation.commit();
        }
    });

    let newPerson = created[2][1];

    // ----------------------------------------------------------------------

    // Check that observing object:save returns expected isNewObject flags
    let EXPECTED_IS_NEW_OBJECT = [
        ["book", true],
        ["book", false],
        ["profile", true],  ["book", true],
        ["book", true]
    ];
    let createdProfileAndNew = created.map((i) => [i[0],i[2]]);
    t.assert(_.isEqual(EXPECTED_IS_NEW_OBJECT, createdProfileAndNew));

    // ----------------------------------------------------------------------

    let EXPECTED_RESULTS = [
        {
            personRef: p0.ref.toString(),
            personVersion: 1,
            personName: "Joe",
            books: [
                {
                    version: 1,
                    title: "Book 0",
                    notes: ["Notes 0"]
                }
            ]
        },
        {
            personRef: p1.ref.toString(),
            personVersion: 1,
            personName: "Jane",
            books: [
                {
                    version: 2,
                    title: "Jane's Really Wonderful Book",
                    notes: ["Nice book", "Notes One"]
                }
            ]
        },
        {
            personRef: newPerson.ref.toString(),
            personVersion: 1,
            personName: "John",
            books: [
                {
                    version: 1,
                    title: "John's Book",
                    notes: ["Notes Two"]
                }
            ]
        },
        {
            personRef: p3.ref.toString(),
            personVersion: 1,
            personName: "Jack",
            books: [
                {
                    version: 1,
                    title: "More Thoughts",
                    notes: ["Notes on Thoughts"]
                },
                {
                    version: 1,
                    title: "Some Thoughts",
                    notes: []
                }
            ]
        }
    ];

    let peopleObjects = [p0, p1, newPerson, p3];
    for(let i = 0; i < peopleObjects.length; ++i) {
        let latestObject = peopleObjects[i].ref.load();
        let expected = EXPECTED_RESULTS[i];
        t.assertEqual(expected.personRef,       latestObject.ref.toString());
        t.assertEqual(expected.personVersion,   latestObject.version);
        t.assertEqual(expected.personName,      latestObject.title);
        let books = O.query().
            link(TYPE["std:type:book"], ATTR.Type).
            link(latestObject.ref, ATTR["dc:attribute:author"]).
            sortByTitle().
            execute();
        t.assertEqual(expected.books.length,    books.length);
        for(let b = 0; b < expected.books.length; ++b) {
            let book = books[b];
            let expectedBook = expected.books[b];
            t.assertEqual(expectedBook.version, book.version);
            t.assertEqual(expectedBook.title,   book.title);
            let bookNotes = book.every(ATTR["std:attribute:notes"]).map((n) => n.toString());
            t.assert(_.isEqual(expectedBook.notes, bookNotes));
        }
    }

});

