/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


P.implementService("haplo:data-import-framework:validate-control", function(control) {
    let errors = [];
    CHECKS.forEach((fn) => {
        let e = fn(control);
        if(e) { errors.push(e); }
    });
    return errors;
});


// --------------------------------------------------------------------------

P.globalFormsCustomValidationFunction("haplo:data-import-framework:control-file", function(value) {
    let file = O.file(value),
        control;
    try {
        control = JSON.parse(file.readAsString("utf-8"));
    } catch(e) {
        return "Not a valid JSON file";
    }
    let errors = O.service("haplo:data-import-framework:validate-control", control);
    if(errors.length) {
        return "Not a valid control file: "+errors.join(", ");
    }
});

P.globalFormsCustomValidationFunction("haplo:data-import-framework:control-json", function(value) {
    let control;
    try {
        control = JSON.parse(value);
    } catch(e) {
        return "Invalid JSON, check syntax";
    }
    let errors = O.service("haplo:data-import-framework:validate-control", control);
    if(errors.length) {
        return "Not a valid control file: "+errors.join(", ");
    }
});


// --------------------------------------------------------------------------

P.findSimpleInstructionForSetValue = function(control, destination, name) {
    let instructions = control.instructions || [];
    for(let i = 0; i < instructions.length; ++i) {
        let inst = instructions[i];
        if(
            ((inst.action||'field') === 'field') &&
            (inst.destination === destination) &&
            (inst.name === name)
        ) {
            return inst;
        }
    }
};


// --------------------------------------------------------------------------

var CHECKS = [
    // Version
    (c) => {
        if(!("dataImportControlFileVersion" in c)) { return "Not a control file"; }
        if(c.dataImportControlFileVersion !== 0)   { return "Bad version of control file, should be 0"; }
    },

    // Model
    (c) => {
        if(!("model" in c)) { return "Control file does not specify model in the model property"; }
        if(!(c.model in P.getAvailableModels())) {
            return "Model not implemented: "+c.model;
        }
    },

    // Instructions in the imported data
    (c) => {
        if(!("instructions" in c)) { return "Control file does not specify processing instructions in the instructions property"; }
        return validateInstructions(c.instructions);
    },

    // Input files
    (c) => {
        if(!("files" in c)) { return "Control file does not have files property"; }
        let e;
        _.each(c.files, (spec, name) => {
            if("read" in spec) {
                if(!O.serviceImplemented("haplo:data-import-framework:reader:"+spec.read)) {
                    e = "Unknown reader for file "+name+": "+spec.read;
                }
            } else {
                e = "Reader not specified for file "+name;
            }
        });
        return e;
    },

    // Processing data from input files
    (c) => {
        if("recordProcessor" in c) {
            if(!O.serviceImplemented("haplo:data-import-framework:record-processor:"+c.recordProcessor)) {
                return "Unknown record processor specified in recordProcessor property: "+c.recordProcessor;
            }
        }
    }

];

// --------------------------------------------------------------------------

var instructionExpectedProperties = {
    "field": ["source", "destination", "name"],
    "field-structured": ["structured", "destination", "name"],
    "set-value": ["destination", "name", "value"],
    "remove-values": ["destination", "name"],
    "if-exists": ["source"],
    "if-value-one-of": ["source"],
    "if-has-value": ["destination", "name"],
    "within": ["source"],
    "for-each": ["source"],
    "assert-destination": ["destination", "exists"],
    "abort-record": ["message"],
    "log-error": ["message"],
    "new": ["destination"],
    "load": ["destination", "using"]
};

var instructionNested = {
    "if-exists": ["then", "else"],
    "if-value-one-of": ["then", "else"],
    "if-has-value": ["then", "else"],
    "for-each": ["instructions"],
    "within": ["instructions"]
};

var assignmentInstruction = [
    "field", "field-structured", "set-value"
];

var validateInstructions = function(instructions, validSingleAssignDestinations) {
    if(!instructions) { return; }
    for(var i = 0; i < instructions.length; ++i) {
        let inst = instructions[i],
            action = inst.action || 'field',
            expected = instructionExpectedProperties[action],
            nested = instructionNested[action];
        if(expected === undefined) {
            return "Unknown action in instruction: "+inst.action;
        } else {
            let notFound = [];
            expected.forEach((p) => {
                if(!(p in inst)) {
                    notFound.push(p);
                }
            });
            if(notFound.length) {
                return "Expected property not found in "+action+" instruction: "+notFound.join(", ");
            }
            if(validSingleAssignDestinations) {
                let usesPermittedDestination = (-1 !== validSingleAssignDestinations.indexOf(inst.destination));
                if((-1 !== assignmentInstruction.indexOf(action)) && (-1 === inst.destination.indexOf("load")) &&
                 !inst.multivalue && !usesPermittedDestination) {
                    return "Assigning values within for-each without a new/load statement or setting multivalue property will result "+
                        "in overwritten data";
                } else if((-1 !== ["new", "load"].indexOf(action)) && !usesPermittedDestination) {
                    validSingleAssignDestinations.push(inst.destination);
                }
            }
            if(nested) {
                for(var n = 0; n < nested.length; ++n) {
                    let validDestinations = (action === "for-each") ? [] : validSingleAssignDestinations;
                    let e = validateInstructions(inst[nested[n]], validDestinations);
                    if(e) { return e; }
                }
            }
        }
        // Special validation
        if(action === "field") {
            // Check filters exist
            if("filters" in inst) {
                if(!_.isArray(inst.filters)) {
                    return "'filters' property is not an array";
                }
                let filters = P.getAvailableFilters();
                for(let f = 0; f < inst.filters.length; ++f) {
                    if(!(inst.filters[f] in filters)) {
                        return "Filter "+inst.filters[f]+" is not available.";
                    }
                }
            }
        }
    }
};
