title: Haplo QA Audit Tool
--

The Haplo QA audit tool exists to flag up possible quality issues in code that is uploaded to a system.

h2. Usage

To upload it to a system:

bq.. IMPORTANT: Run the normal plugin tool for the app, and leave it running. Then run this command:

   scripts/use-qa-audit -s <servername>

in the same directory you are running the plugin tool from, using ../ to get back to the phd directory

p. To use it, click on SUPPORT, and an entry will appear saying QA Audit: XX issues. We should aim to get this down to 0 issues for each system, either by fixing the issues flagged by the QA Audit tool, or by suppressing issues when we know better.

h3. Supressing issues

To supress an issue, you should add an entry in @__qa__.json@ in the relevant plugin. The entry should use the long name for the issue provided on the issues page, and provide a message explaining why this suppression makes sense.

Example:

bc. {
    "suppress": {
        "example-code-issue/example_plugin/identifier":
            "This issue needs to be suppressed"
    }
}

h3. Adding new issue types

There are two services that might be useful when trying to add a new type of issue.

The most important is @"haplo:qa-audit:identify-issues"@. You should either add anew implementation of this service, or add to an existing implementation of this service when adding your new issue. Within the implementation, use the provided data to check whether the issue you are expecting has arisen. If you identify the issue, call @audit.issue(longCode, shortName, longDescription)@

If you do not have enough data to make a judgement, you can implement (or add to an implemntation of) @"haplo:qa-audit:gather-information"@. The purpose of this service is to collect information about various plugins and features that is needed to correctly identify issues.