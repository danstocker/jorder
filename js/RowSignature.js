/*global dessert, troop, sntls, jorder */
troop.postpone(jorder, 'RowSignature', function () {
    "use strict";

    var hOP = Object.prototype.hasOwnProperty;

    /**
     * Instantiates class.
     * @name jorder.RowSignature.create
     * @function
     * @param {string[]} fieldNames Field names
     * @param {string} [signatureType='string'] Signature type, see SIGNATURE_TYPES.
     * @param {boolean} [isCaseInsensitive=false] Whether signature is case insensitive.
     * @returns {jorder.RowSignature}
     */

    /**
     * Row signature. Typed primitive representation of a table row, with validation and generation.
     * @class jorder.RowSignature
     * @extends troop.Base
     */
    jorder.RowSignature = troop.Base.extend()
        .addConstants(/** @lends jorder.RowSignature */{
            /**
             * Field separator, must be escapable w/ encodeURI
             * @type {string}
             * @constant
             */
            FIELD_SEPARATOR_STRING: '|',

            /**
             * Field separator for numeric signature.
             * Signature is calculated by (quasi-) shifting field
             * values by 32 bits.
             * @type {number}
             * @constant
             */
            FIELD_SEPARATOR_NUMBER: Math.pow(2, 32),

            /**
             * Regular expression for splitting along word boundaries
             * @type {RegExp}
             * @constant
             */
            RE_WORD_DELIMITER: /\s+/,

            /**
             * Separates signature type in field signature from fields, must be escapable w/ encodeURI
             * @type {string}
             * @constant
             */
            SIGNATURE_TYPE_SEPARATOR: '%',

            /**
             * Signature must be one of these types
             * @constant
             */
            SIGNATURE_TYPES: {
                array   : 'array',
                fullText: 'fullText',
                number  : 'number',
                string  : 'string'
            }
        })
        .addPrivateMethods(/** @lends jorder.RowSignature# */{
            /**
             * Creates an array of specified length & filled with
             * the specified value at each position.
             * @param {number} length
             * @param {*} value
             * @returns {Array}
             * @private
             * @memberOf jorder.RowSignature
             */
            _createUniformArray: function (length, value) {
                var result = new Array(length),
                    i;
                for (i = 0; i < length; i++) {
                    result[i] = value;
                }
                return result;
            },

            /**
             * Collection iteration handler URI encoding string items.
             * @param {string} item Collection item
             * @returns {string}
             * @private
             */
            _uriEncoder: function (item) {
                return this.isCaseInsensitive ?
                    encodeURI(item.toLowerCase()) :
                    encodeURI(item);
            },

            /**
             * Collection iteration handler URI encoding string array items.
             * @param {Array} item Item in an array collection.
             * @returns {Array}
             * @private
             */
            _arrayUriEncoder: function (item) {
                var result = [],
                    i, elem;
                for (i = 0; i < item.length; i++) {
                    elem = item[i];
                    if (typeof elem === 'string') {
                        result.push(this.isCaseInsensitive ?
                            encodeURI(elem.toLowerCase()) :
                            encodeURI(elem));
                    } else {
                        result.push(String(elem));
                    }
                }
                return result;
            }
        })
        .addMethods(/** @lends jorder.RowSignature# */{
            /**
             * @param {string[]} fieldNames Field names
             * @param {string} [signatureType='string'] Signature type, see SIGNATURE_TYPES.
             * @param {boolean} [isCaseInsensitive=false] Whether signature is case insensitive.
             * @ignore
             */
            init: function (fieldNames, signatureType, isCaseInsensitive) {
                dessert
                    .isArray(fieldNames, "Invalid field names")
                    .assert(!!fieldNames.length, "Empty field name list")
                    .isStringOptional(signatureType, "Invalid signature type")
                    .isBooleanOptional(isCaseInsensitive, "Invalid case flag");

                var SIGNATURE_TYPES = this.SIGNATURE_TYPES;

                // conditional assertions
                if (signatureType) {
                    // validating signature type
                    dessert.assert(SIGNATURE_TYPES.hasOwnProperty(signatureType), "Invalid signature type");
                }

                /**
                 * @type {String[]}
                 */
                this.fieldNames = fieldNames;

                /**
                 * Lookup object for field names
                 * @type {object}
                 */
                this.fieldNameLookup = sntls.StringDictionary
                    .create({
                        1: fieldNames
                    })
                    .reverse()
                    .items;

                /**
                 * @type {string}
                 * @default SIGNATURE_TYPES.string
                 */
                this.signatureType = signatureType || SIGNATURE_TYPES.string;

                /**
                 * @type {boolean}
                 * @default false
                 */
                this.isCaseInsensitive = !!isCaseInsensitive;

                /**
                 * Signature composed of field names and type
                 * This is the signature that may identify an index
                 * (Row signatures don't contain type info)
                 * @type {String}
                 */
                this.fieldSignature = [
                    this._arrayUriEncoder(fieldNames)
                        .join(this.FIELD_SEPARATOR_STRING),
                    this.signatureType
                ].join(this.SIGNATURE_TYPE_SEPARATOR);
            },

            /**
             * Generates a key for the submitted row based on the current signature rules.
             * @param {object} row Raw table row
             * @returns {string|number}
             */
            getKeyForRow: function (row) {
                var SIGNATURE_TYPES = this.SIGNATURE_TYPES,
                    fieldNames = this.fieldNames,
                    radices, digits;

                if (this.containedByRow(row)) {
                    // row matches signature

                    switch (this.signatureType) {
                    case SIGNATURE_TYPES.number:
                        // extracting numeric key
                        if (fieldNames.length === 1) {
                            return row[fieldNames[0]];
                        } else {
                            radices = this._createUniformArray(fieldNames.length, this.FIELD_SEPARATOR_NUMBER);
                            digits = sntls.Collection.create(row)
                                .filterByKeys(fieldNames)
                                .getValues();

                            return jorder.IrregularNumber.create(radices)
                                .setDigits(digits)
                                .asScalar;
                        }
                        break;

                    case SIGNATURE_TYPES.string:
                        // extracting string key
                        if (fieldNames.length === 1) {
                            return this._uriEncoder(row[fieldNames[0]]);
                        } else {
                            return sntls.StringCollection.create(row)
                                // reducing row to relevant fields
                                .filterByKeys(fieldNames)
                                // encoding field values
                                .mapValues(this._uriEncoder, this)
                                .getValues()
                                // joining encoded values into signature string
                                .join(this.FIELD_SEPARATOR_STRING);
                        }
                        break;

                    default:
                        dessert.assert(false, "Invalid signature type");
                        return ''; // will never be reached
                    }
                } else {
                    // row does not match signature
                    return undefined;
                }
            },

            /**
             * Generates multiple keys for the submitted row based on the current signature rules.
             * @param {object} row Raw table row
             * @returns {string[]}
             */
            getKeysForRow: function (row) {
                if (!row) {
                    // empty array when no row is given
                    return [];
                }

                var SIGNATURE_TYPES = this.SIGNATURE_TYPES,
                    fieldNames = this.fieldNames,
                    key;

                switch (this.signatureType) {
                case SIGNATURE_TYPES.array:
                    if (fieldNames.length === 1) {
                        // quick solution for single-field signature
                        // returning first field as is (already array)
                        return this._arrayUriEncoder(row[fieldNames[0]]);
                    } else {
                        // calculating all possible signatures for row
                        return sntls.Collection.create(row)
                            // reducing row to relevant fields
                            .filterByKeys(fieldNames)
                            // discarding field names in row
                            .getValuesAsHash()
                            // getting all combinations w/ each field contributing one of their items
                            .toMultiArray()
                            .getCombinationsAsHash()
                            // joining combinations to make strings
                            .toCollection()
                            .mapValues(this._arrayUriEncoder, this, sntls.ArrayCollection)
                            .join(this.FIELD_SEPARATOR_STRING)
                            .getValues();
                    }
                    break;

                case SIGNATURE_TYPES.fullText:
                    if (fieldNames.length === 1) {
                        // quick solution for single-field signature
                        // extracting multiple keys by splitting into words
                        return this._arrayUriEncoder(row[fieldNames[0]].split(this.RE_WORD_DELIMITER));
                    } else {
                        // calculating all possible signatures for row
                        return sntls.StringCollection.create(row)
                            // reducing row to relevant fields
                            .filterByKeys(fieldNames)
                            // splitting all fields into words
                            .split(this.RE_WORD_DELIMITER)
                            // discarding field names in row
                            .getValuesAsHash()
                            // getting all word combinations w/ each field contributing one word
                            .toMultiArray()
                            .getCombinationsAsHash()
                            // joining combinations to make strings
                            .toCollection()
                            .mapValues(this._arrayUriEncoder, this, sntls.ArrayCollection)
                            .join(this.FIELD_SEPARATOR_STRING)
                            .getValues();
                    }
                    break;

                default:
                case SIGNATURE_TYPES.number:
                case SIGNATURE_TYPES.string:
                    // extracting single key wrapped in array
                    key = this.getKeyForRow(row);
                    return key ? [key] : [];
                }
            },

            /**
             * Tells whether all signature fields are present in the row,
             * ie. that the row fits the signature fully.
             * @param {object} row Raw table row
             * @returns {boolean}
             * TODO: adding type check
             */
            containedByRow: function (row) {
                var fieldNames = this.fieldNames,
                    i;

                for (i = 0; i < fieldNames.length; i++) {
                    if (!hOP.call(row, fieldNames[i])) {
                        // signature field is not in row
                        return false;
                    }
                }

                return true;
            },

            /**
             * Tells whether all row fields are present in the signature.
             * @param {object} row Raw table row
             * @returns {boolean}
             */
            containsRow: function (row) {
                var fieldNameLookup = this.fieldNameLookup,
                    rowFieldNames = Object.keys(row),
                    i;

                for (i = 0; i < rowFieldNames.length; i++) {
                    if (!hOP.call(fieldNameLookup, rowFieldNames[i])) {
                        // row field is not in signature
                        return false;
                    }
                }

                return true;
            }
        });
});
