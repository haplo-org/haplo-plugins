/* Haplo Plugins                                     https://haplo.org
 * (c) Haplo Services Ltd 2006 - 2017   https://www.haplo-services.com
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.         */

(function($) {
    $(document).on('ready', function() {
        $('.select-all').on('click', function() {
            $('.oforms-radio-vertical').find(':checkbox').prop('checked', true);
        });
        $('.deselect-all').on('click', function() {
            $('.oforms-radio-vertical').find(':checkbox').prop('checked', false);
        });
    });
})(jQuery);
