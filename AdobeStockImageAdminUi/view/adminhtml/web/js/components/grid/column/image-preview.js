/**
 * Copyright © Magento, Inc. All rights reserved.
 * See COPYING.txt for license details.
 */
define([
    'underscore',
    'jquery',
    'knockout',
    'Magento_Ui/js/grid/columns/column',
    'Magento_AdobeIms/js/action/authorization',
    'Magento_AdobeStockImageAdminUi/js/model/messages',
    'mage/translate'
], function (_, $, ko, Column, authorizationAction, messages) {
    'use strict';

    return Column.extend({
        defaults: {
            mediaGallerySelector: '.media-gallery-modal:has(#search_adobe_stock)',
            adobeStockModalSelector: '#adobe-stock-images-search-modal',
            previewImageSelector: '[data-image-preview]',
            modules: {
                thumbnailComponent: '${ $.parentName }.thumbnail_url'
            },
            visibility: [],
            height: 0,
            limit: 5,
            saveAvailable: true,
            statefull: {
                visible: true,
                sorting: true,
                lastOpenedImage: true
            },
            tracks: {
                lastOpenedImage: true,
            },
            lastOpenedImage: null,
            downloadImagePreviewUrl: Column.downloadImagePreviewUrl,
            messageDelay: 5,
            authConfig: {
                url: '',
                isAuthorized: false,
                stopHandleTimeout: 10000,
                windowParams: {
                    width: 500,
                    height: 600,
                    top: 100,
                    left: 300
                },
                response: {
                    regexpPattern: /auth\[code=(success|error);message=(.+)\]/,
                    codeIndex: 1,
                    messageIndex: 2,
                    successCode: 'success',
                    errorCode: 'error'
                }
            }
        },

        /**
         * Init observable variables
         * @return {Object}
         */
        initObservable: function () {
            this._super()
                .observe([
                    'visibility',
                    'height'
                ]);

            this.height.subscribe(function(){
                this.thumbnailComponent().previewHeight(this.height());
            }, this);
            return this;
        },

        /**
         * Return id of the row.
         *
         * @param record
         * @returns {*}
         */
        getId: function (record) {
            return record.id;
        },

        /**
         * Returns url to given record.
         *
         * @param {Object} record - Data to be preprocessed.
         * @returns {String}
         */
        getUrl: function (record) {
            return record.preview_url;
        },

        /**
         * Returns title to given record.
         *
         * @param {Object} record - Data to be preprocessed.
         * @returns {String}
         */
        getTitle: function (record) {
            return record.title || 'Title';
        },

        /**
         * Returns author full name to given record.
         *
         * @param {Object} record - Data to be preprocessed.
         * @returns {String}
         */
        getAuthor: function (record) {
            return record.creator.name || 'Author';
        },

        /**
         * Returns attributes to display under the preview image
         *
         * @param record
         * @returns {*[]}
         */
        getDisplayAttributes: function(record) {
            return [
                {
                    name: 'Dimensions',
                    value: record.width + ' x ' + record.height + ' px'
                },
                {
                    name: 'File type',
                    value: record.content_type.toUpperCase()
                },
                {
                    name: 'Category',
                    value: record.category.name || 'None'
                },
                {
                    name: 'File #',
                    value: record.id
                }
            ];
        },

        /**
         * Returns keywords to display under the attributes image
         *
         * @param record
         * @returns {*[]}
         */
        getKeyWords: function(record) {
            return record.keywords;
        },

        /**
         * Returns keywords limit to show no of keywords
         *
         * @param record
         * @returns {*}
         */
        getKeyWordsLimit: function (record){
            if (!record.limit) {
                record.limit = ko.observable(this.limit);
            }
            return record.limit();
        },

        /**
         * Show all the related keywords
         *
         * @param record
         * @returns {*}
         */
        viewAllKeyWords: function(record) {
            record.limit(record.keywords.length);
        },

        /**
         * Check if view all button is visible or not
         *
         * @param record
         * @returns {*}
         */
        isButtonVisible: function(record) {
            if (!record.buttonVisible) {
                record.buttonVisible = ko.observable(true);
            }
            if (record.limit() === record.keywords.length) {
                record.buttonVisible(false);
            }
            return record.buttonVisible();
        },

        /**
         * Returns visibility for given record.
         *
         * @param {Object} record
         * @return {*|boolean}
         */
        isVisible: function (record) {
            if (this.lastOpenedImage === record._rowIndex &&
                (this.visibility()[record._rowIndex] === undefined || this.visibility()[record._rowIndex] === false)
            ) {
                this.show(record);
            }
            return this.visibility()[record._rowIndex] || false;
        },

        /**
         * Get styles for preview
         *
         * @param {Object} record
         * @returns {Object}
         */
        getStyles: function (record){
            if(!record.previewStyles) {
                record.previewStyles = ko.observable();
            }
            record.previewStyles({
                'margin-top': '-' + this.height()
            });
            return record.previewStyles;
        },

        /**
         * Next image preview
         *
         * @param record
         */
        next: function (record){
            this._selectRow(record.lastInRow ? record.currentRow + 1 : record.currentRow);
            this.show(record._rowIndex + 1);
        },

        /**
         * Previous image preview
         *
         * @param record
         */
        prev: function (record){
            this._selectRow(record.firstInRow ? record.currentRow - 1 : record.currentRow);
            this.show(record._rowIndex - 1);
        },

        /**
         * Set selected row id
         *
         * @param {Number} rowId
         * @private
         */
        _selectRow: function (rowId){
            this.thumbnailComponent().previewRowId(rowId);
        },

        /**
         * Show image preview
         *
         * @param {Object|Number} record
         */
        show: function (record) {
            var visibility = this.visibility(),
                img;

            this.lastOpenedImage = null;
            if(~visibility.indexOf(true)) {// hide any preview
                if(!Array.prototype.fill) {
                    visibility = _.times(visibility.length, _.constant(false));
                } else {
                    visibility.fill(false);
                }
            }
            if(this._isInt(record)) {
                visibility[record] = true;
            } else {
                this._selectRow(record.currentRow);
                visibility[record._rowIndex] = true;
            }
            this.visibility(visibility);

            img = $(this.previewImageSelector + ' img');
            if(img.get(0).complete) {
                this._updateHeight();
            } else {
                img.load(this._updateHeight.bind(this));
            }
            this.lastOpenedImage = this._isInt(record) ? record : record._rowIndex;
        },

        /**
         *
         * @private
         */
        _updateHeight: function (){
            this.height($(this.previewImageSelector).height() + 'px');// set height
            this.visibility(this.visibility());// rerender
            this.scrollToPreview();
        },

        /**
         * Scroll to preview window
         */
        scrollToPreview: function () {
            $(this.previewImageSelector).get(0).scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest"
            });
        },

        /**
         * Close image preview
         */
        hide: function () {
            var visibility = this.visibility();

            this.lastOpenedImage = null;
            visibility.fill(false);
            this.visibility(visibility);
            this.height(0);
            this._selectRow(null);
        },

        /**
         * Check if value is integer
         *
         * @param value
         * @returns {boolean}
         * @private
         */
        _isInt: function (value) {
            return !isNaN(value) && (function(x) { return (x | 0) === x; })(parseFloat(value))
        },

        /**
         * Save record as image
         *
         * @param record
         */
        save: function (record) {
            var mediaBrowser = $(this.mediaGallerySelector).data('mageMediabrowser');
            $(this.adobeStockModalSelector).trigger('processStart');
            $.ajax(
                {
                    type: 'POST',
                    url: this.downloadImagePreviewUrl,
                    dataType: 'json',
                    data: {
                       'media_id': record.id,
                       'destination_path': mediaBrowser.activeNode.path || ''
                    },
                    context: this,
                    success: function () {
                        $(this.adobeStockModalSelector).trigger('processStop');
                        $(this.adobeStockModalSelector).trigger('closeModal');
                        mediaBrowser.reload(true);
                    },
                    error: function (response) {
                        $(this.adobeStockModalSelector).trigger('processStop');
                        messages.add('error', response.responseJSON.message);
                        messages.scheduleCleanup(3);
                    }
               }
           );
        },

        /**
         * Get messages
         *
         * @return {Array}
         */
        getMessages: function () {
            return messages.get();
        },

        /**
         * License and save image
         *
         * @param {Object} record
         */
        licenseAndSave: function (record) {
            /** @todo add license functionality */
            console.warn('add license functionality');
            console.dir(record);
        },

        /**
         * Process of license
         *
         * @param {Object} record
         */
        licenseProcess: function (record) {
            if (this.authConfig.isAuthorized) {
                this.licenseAndSave(record);

                return;
            }

            /**
             * Opens authorization window of Adobe Stock
             * then starts the authorization process
             */
            authorizationAction(this.authConfig)
                .then(
                    function (authConfig) {
                        this.authConfig = _.extend(this.authConfig, authConfig);
                        this.licenseProcess(record);
                        messages.add('success', authConfig.lastAuthSuccessMessage);
                    }.bind(this)
                )
                .catch(
                    function (error) {
                        messages.add('error', error.message);
                    }.bind(this)
                )
                .finally((function () {
                    messages.scheduleCleanup(this.messageDelay);
                }).bind(this));
        }
    });
});
