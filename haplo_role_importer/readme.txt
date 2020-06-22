title: Role importer
--

A quicker way of exporting/importing research institute and committee roles.

To use:

* Install the plugin to the system you are copying from and the system you are copying to with @haplo-plugin -p haplo-plugins/haplo_role_importer --force@.

* Find 'Role importer' in admin menu, 'Export' on system with the data, paste data into text box on the new system. It does a dry run before being applied.

It matches based on titles for Research Institute, and on emails first for people (but falls back to title if an email match cannot be found)

Current Limits: doesn't support multiple research institutes on committees

TODO: genericism (supporting arbitrary types?)
      shouldn't specify hres schema
      export/import from file
      exporting of individual objects?
      would be good to be able to move the config data over as well, replacing any refs with the equivalent in the new system
      copy over appearance settings
