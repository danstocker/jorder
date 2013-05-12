/**
 * Datastore Index
 */
/*global dessert, troop, sntls, jorder */
troop.promise(jorder, 'Index', function () {
    "use strict";

    /**
     * @class jorder.Index
     * @extends troop.Base
     */
    jorder.Index = troop.Base.extend()
        .addMethod(/** @lends jorder.Index */{
            /**
             * @name jorder.Index.create
             * @return {jorder.Index}
             */

            /**
             * @param {string[]} fieldNames Field names
             * @param {number} [signatureType='string'] Signature type, see SIGNATURE_TYPES
             */
            init: function (fieldNames, signatureType) {
                /**
                 * Row signature associated with index.
                 * Provides validation and index key generation.
                 * @type {jorder.RowSignature}
                 */
                this.rowSignature = jorder.RowSignature.create(fieldNames, signatureType);

                /**
                 * Holds index key -> row ID associations.
                 * One index key may reference more than one row IDs.
                 * @type {sntls.StringDictionary}
                 */
                this.rowIdLookup = sntls.StringDictionary.create();

                /**
                 * Holds index keys in ascending order. (With multiplicity)
                 * TODO: investigate no-multiplicity solution
                 * @type {sntls.OrderedList}
                 */
                this.sortedKeys = sntls.OrderedStringList.create();
            },

            /**
             * Adds single row to index.
             * @param {object} row Table row
             * @param {string} rowId Row ID: original index of row in table
             * @return {jorder.Index}
             */
            addRow: function (row, rowId) {
                // calculating index keys based on row
                var keys = this.rowSignature.getKeysForRow(row);

                // adding key / rowId pairs to lookup index
                this.rowIdLookup.addItems(keys, rowId);

                // adding keys to ordered index (w/ multiplicity)
                this.sortedKeys.addItems(keys);

                return this;
            },

            /**
             * Removes single row from index.
             * @param {object} row Table row
             * @param {string} rowId Row ID: original index of row in table
             * @return {jorder.Index}
             */
            removeRow: function (row, rowId) {
                // calculating index keys based on row
                var keys = this.rowSignature.getKeysForRow(row);

                // removing key / rowId pairs from lookup index
                this.rowIdLookup.removeItems(keys, rowId);

                // removing keys from ordered index (w/ multiplicity)
                this.sortedKeys.removeItems(keys);

                return this;
            },

            /**
             * Retrieves a list of row ids associated with the specified keys.
             * @param {string[]|number[]} keys
             * @return {string[]}
             */
            getRowIdsForKeys: function (keys) {
                return sntls.StringDictionary.create(keys)
                    .combineWith(this.rowIdLookup)// selecting row IDs for specified keys
                    .reverse()// collapsing unique row IDs
                    .getKeys();
            },

            /**
             * Retrieves a list of unique row IDs matching index values
             * that fall between the specified bounds.
             * @param {string|number} startValue Lower index bound
             * @param {string|number} endValue Upper index bound
             * @param {number} [offset] Starting position of results
             * @param {number} [limit]
             * @return {string[]}
             */
            getRowIdsForKeyRange: function (startValue, endValue, offset, limit) {
                return this.sortedKeys.getRangeAsHash(startValue, endValue)
                    .toStringDictionary()
                    .reverse()// collapsing unique index values
                    .getKeysAsHash()// getting unique index values in a hash
                    .toStringDictionary()
                    .combineWith(this.rowIdLookup)// obtaining row IDs from lookup
                    .reverse()// collapsing unique row IDs
                    .getKeys();
            }
        });
});

(function () {
    "use strict";

    dessert.addTypes(/** @lends dessert */{
        isIndex: function (expr) {
            return jorder.Index.isBaseOf(expr);
        },

        isIndexOptional: function (expr) {
            return typeof expr === 'undefined' ||
                   jorder.Index.isBaseOf(expr);
        }
    });
}());
