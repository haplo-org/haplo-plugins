/* Haplo Plugins                                      http://haplo.org
 * (c) Haplo Services Ltd 2006 - 2016    http://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */


(function($) {

    var TwitterUsernameValue = function(value) {
        this.username = value[0] || '';
    };
    _.extend(TwitterUsernameValue.prototype, {
        generateHTML: function() {
            var html = ['@<input type="text" size="20" value="', _.escape(this.username), '" maxlength=15 size=15>'];
            return html.join('');
        },
        attach: function(container) {
        },
        getValue: function(container) {
            var username = $.trim(($('input', container)[0].value || '')).replace(/[^a-zA-Z0-9_]/g,'');
            return username.length ? [username] : null;
        },
        undoableDeletedText: function(container) {
            var username = this.getValue(container);
            return username ? 'username:'+username[0] : null;
        }
    });

    Haplo.editor.registerTextType("haplo:twitter", function(value) {
        return new TwitterUsernameValue(value);
    });

})(jQuery);
