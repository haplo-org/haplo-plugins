/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2019            https://www.haplo.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


/*
    Terminology:

        Model: Description of the data structure within the Haplo application.

        Destination: Description of the various places in the data model where data can be applied.

        Pseudo Destination: A destination that's used for building structured values and loading objects (so you can use all the transforms etc), rather than actually representing something that gets committed.

        Name: The name of a 'slot' for data (such as JS property or store object attribute) within a Destination.

        Control: JSON structure describing a data import, with the name of the Model, the format of the input files, any transformations, and where the values from the inputs end up in Destinations witin the Model.

        Instruction: The control file contains instructions on how to interpret the data, with limited support for conditionals and looping.

        Batch: A collection of input files along with a Control, which can import data.

        Record: A distinct collection of data representing one 'thing' from the input files.

        Context: When processing instructions, the current data from the input file. This starts as the Record, instructions may descend into nest data structures.

        Reader: A function which calls an iterator with every row from an input file.

        Destination Target: The actual object the data ends up in, eg JS objects, Store objects, ...

        Transformation: An object representing the data from a single record, transformed via Destinations into Destination Targets

*/

// --------------------------------------------------------------------------

// errorCallback takes (message, record) where record is optional
P.implementService("haplo:data-import-framework:batch", function(control, files, errorCallback) {
    let errors = O.service("haplo:data-import-framework:validate-control", control);
    if(errors.length) {
        throw new Error("Errors in control file:\n  "+errors.join("\n  "));
    }
    let model = O.service("haplo:data-import-framework:model", control.model),
        batch = new Batch(control, model, files, errorCallback);
    return batch._setup();
});

// --------------------------------------------------------------------------

const MAX_ERRORS_TO_REPORT = 500;
const MAX_DEPENDENT_DESTINATION_DEPTH = 16;

// --------------------------------------------------------------------------

var Batch = function(control, model, files, errorCallback) {
    this.control = control;
    this.model = model;
    this._files = files;
    this._errorCallback = errorCallback;
    this._recordCount = 0;
    this._errorCount = 0;
    this._observers = {};
    this._filterFunctions = {};
    this._externalData = {};
};

Batch.prototype = {

    _setup() {
        this._instructions = this._prepareInstructionList(this.control.instructions);
        return this;
    },

    option(name, value) {
        if((name === "report-all-errors") && value) {
            this._opt_reportAllErrors = true;
        }
    },

    externalData(externalData) {
        _.extend(this._externalData, externalData||{});
    },

    getExternalData() {
        return Object.create(this._externalData);
    },

    getReaders() {
        let readers = [];
        _.each(this._files, (file, name) => {
            let spec = this.control.files[name] || this.control.files.DEFAULT;
            if(!spec) {
                throw new Error("Could not find file specification in control file for file "+name+" (and DEFAULT file entry does not exist)");
            }
            readers.push({name:name, reader:O.service("haplo:data-import-framework:reader:"+spec.read, file, spec)});
        });
        if("recordProcessor" in this.control) {
            readers = O.service("haplo:data-import-framework:record-processor:"+this.control.recordProcessor, readers);
        }
        return readers;
    },

    observe(name, callback) {
        if(!(name in this._observers)) { this._observers[name] = []; }
        this._observers[name].push(callback);
        return this;
    },

    eachRecord(iterator) {
        this.getReaders().forEach((r) => {
            r.reader(iterator);
        });
    },

    prepareTransformation(record, recordIdentifier) {
        // state for error reporting
        this._currentRecord = record;
        this._currentRecordIdentifier = recordIdentifier || ('record '+this._recordCount);
        // Transformation object
        let transformation = new Transformation(this, record);
        this._recordCount++;
        return transformation;
    },

    transform(record, recordIdentifier) {
        let transformation = this.prepareTransformation(record, recordIdentifier);
        transformation.transform();
        return transformation;
    },

    _notifyObserver(name, args) {
        (this._observers[name] || []).forEach((fn) => {
            fn.apply(undefined, args);
        });
    },

    _reportError(message) {
        this._errorCount++;
        if(this._errorCallback) {
            if((this._errorCount < MAX_ERRORS_TO_REPORT) || this._opt_reportAllErrors) {
                // Append record identifier if currently processing a record
                if(this._currentRecordIdentifier) {
                    message = message + " (" + this._currentRecordIdentifier + ")";
                }
                this._errorCallback(message, this._currentRecord);
            } else if(this._errorCount === MAX_ERRORS_TO_REPORT) {
                this._errorCallback("Too many errors in import batch, no further errors will be reported", this._currentRecord);
            } else {
                // don't report, just increment the error count
            }
        }
    },

    get errorCount() {
        return this._errorCount;
    },

    _prepareInstructionList(ctrlInsts) {
        if(!ctrlInsts) { return; }
        let instructions = [];
        ctrlInsts.forEach((inst) => {
            let action = inst.action || 'field',
                constructor = P.instructionConstructors[action];
            if(constructor) {
                let instructionFn = constructor(this, inst);
                if(instructionFn) { instructions.push(instructionFn); }
            } else {
                this.batch._reportError("Unknown action in instruction: " + action);
            }
        });
        return instructions;
    },

    // Returns a function that given a record, returns the value that would
    // be written set in destination/name. Will only work for simple
    // instructions, and definately not in anything conditional.
    // Returns null if it's not possible.
    makeExtractFunctionFromSimpleInstructionFor(destination, name) {
        let inst = P.findSimpleInstructionForSetValue(this.control, destination, name);
        if(!inst) { return null; }
        return P.makeExtractFunctionForSimpleFieldInstruction(this, inst);
    }

};

// --------------------------------------------------------------------------

var Transformation = function(batch, record) {
    this.batch = batch;
    this.record = record;
    this._destinationTargets = {};
    this._committers = [];
    this.isComplete = true;
};

Transformation.prototype = {

    abortRecord() {
        this.isComplete = false;
    },

    transform() {
        let instructions = this.batch._instructions,
            destinations = this.batch.model._destinations,
            record = this.record;
        // Execute all the instructions to add the data to the targets
        this._executeInstructionList(instructions, record);
        // If the transformation was aborted, any further checks aren't
        // going to be helpful.
        if(this.isComplete) {
            // Check targets which have been created or destination isn't optional
            _.each(destinations, (destination, destinationName) => {
                if(!destination._isPseudoDestination) {
                    let target = this._destinationTargets[destinationName];
                    if(target || !destination.delegate.optional) {
                        destination.checkTarget(target, this);
                    }
                }
            });
        }
    },

    _checkedDestinationCommitingCurrentTarget(destinationName) {
        let destination = this.batch.model._destinations[destinationName];
        if(!destination) { throw new Error("Unknown destination: "+destinationName); }
        // If there's currently a target, it needs to be committed
        let currentTarget = this._destinationTargets[destinationName];
        if(currentTarget) {
            destination.checkTarget(currentTarget, this);
            let c = destination.createCommitter(currentTarget, this);
            if(c) { this._committers.push(c); }
            delete this._destinationTargets[destinationName];
        }
        return destination;
    },

    newTargetForDestination(destinationName) {
        let destination = this._checkedDestinationCommitingCurrentTarget(destinationName);
        this._destinationTargets[destinationName] = destination.constructNewDestinationTarget();
    },

    tryLoadTargetForDestination(destinationName, loadInfo) {
        let destination = this._checkedDestinationCommitingCurrentTarget(destinationName);
        let target = destination.tryLoadDestinationTarget(loadInfo);
        if(target) {
            this._destinationTargets[destinationName] = target;
        }
        return !!target;
    },

    getTarget(name) {
        return this._getTarget(name, MAX_DEPENDENT_DESTINATION_DEPTH);
    },

    getTargetMaybe(name) {
        return this._destinationTargets[name];
    },

    setTarget(name, target) {
        let destination = this._checkedDestinationCommitingCurrentTarget(name);
        this._destinationTargets[name] = target;
    },

    _getTarget(name, safety, dependentPath) {
        if(safety < 0) { throw new Error("getTarget() maximum recursion limit exceeded"); }
        let target = this._destinationTargets[name];
        if(!target) {
            let destination = this.batch.model._destinations[name];
            if(!destination) {
                throw new Error("No destination when requesting target: "+name);
            }
            if(destination._depends) {
                // Destinations which depend on others can be newed/loaded automatically
                // if there's a target for the destination they depend on.
                let depends = destination._depends;
                let dependentTarget = this._getTarget(depends, safety-1, (dependentPath||'')+name+' ');
                target = destination.tryMakeTargetAvailableForDependency(depends, dependentTarget);
                if(target) {
                    this._destinationTargets[name] = target;
                } else {
                    this.abortRecord();
                    this.batch._reportError("Couldn't make destination \""+name+'" available from dependency "'+depends+'"');
                }
            } else {
                if(!destination._isPseudoDestination) {
                    // A target hasn't been explicitly loaded/created for this destination.
                    // As it's not a pseudo destination, this transformation is aborted.
                    // The blank target object is created, so everything else can continue,
                    // even if the work is thrown away.
                    this.abortRecord();
                    let err = 'Destination "'+name+'" needs be made ready with a "new" or "load" instruction';
                    if(dependentPath) { err += ', required by use of '+dependentPath; }
                    this.batch._reportError(err);
                }
            }
            if(!target) {
                // Implicit blank target for pseudo destinations (and fallback for aborted transformations)
                target = this._destinationTargets[name] = destination.constructNewDestinationTarget();
            }
        }
        return target;
    },

    clearTarget(name) {
        delete this._destinationTargets[name];
    },

    commit() {
        // Build list of committers for all the destinations, including committers generated during
        // execution of the instructions.
        let committers = this._committers,
            destinations = this.batch.model._destinations;
        _.each(this._destinationTargets, (target, destinationName) => {
            let destination = destinations[destinationName];
            let c = destination.createCommitter(target, this);
            if(c) { committers.push(c); }
        });
        // Call all the committers
        committers.forEach((fn) => fn());
    },

    _executeInstructionList(instructions, context) {
        if(!instructions) { return; }
        let l = instructions.length;
        for(let i = 0; i < l; ++i) {
            instructions[i](this, context);
        }
    }

};
