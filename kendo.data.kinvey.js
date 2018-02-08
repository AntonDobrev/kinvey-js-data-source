(function () {
    "use strict";

    var ERROR_MESSAGES = {
        "NoKinveyInstanceMessage": "An instance of the Kinvey JavaScript SDK is not available. Initialize the Kinvey global object.",
        "NoDataStoreCollectionNameMessage": "A collection name or a data store instance must be provided to the data source options.",
        "BatchCreateNotSupportedMessage": "Batch create is not supported. Set the data source 'batch' option to 'false'.",
        "BatchUpdateNotSupportedMessage": "Batch update is not supported. Set the data source 'batch' option to 'false'.",
        "BatchDeleteNotSupportedMessage": "Batch delete is not supported. Set the data source 'batch' option to 'false'."
    };

    var CONSTANTS = {
        idField: "_id"
    };

    if ((typeof window !== typeof undefined && typeof window.jQuery === typeof undefined) || (typeof window.kendo === typeof undefined || !window.kendo.data)) {
        return;
    }

    var $ = window.jQuery,
        kendo = window.kendo,
        extend = $.extend,
        each = $.each,
        isArray = Array.isArray,
        total = null,
        shouldRefreshCount = false;

    var kinveyTransport = kendo.data.RemoteTransport.extend({
        init: function (options) {
            if (!Kinvey) {
                throw new Error(ERROR_MESSAGES.NoKinveyInstanceMessage);
            }

            if (!options.typeName && !options.dataStore) {
                throw new Error(ERROR_MESSAGES.NoDataStoreCollectionNameMessage);
            }

            this.dataStore = options.dataStore ? options.dataStore : Kinvey.DataStore.collection(options.typeName, Kinvey.DataStoreType.Network);

            kendo.data.RemoteTransport.fn.init.call(this, options);
        },
        read: function (options) {
            var methodOption = this.options.read;
            var self = this;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var queryOptions = {};
            queryOptions = translateKendoQuery(options.data);
            var query = new Kinvey.Query(queryOptions);

            if (options.data.skip >= 0 || options.data.take >= 0 || shouldRefreshCount) {
                var countQueryOptions = {};
                countQueryOptions.filter = queryOptions.filter;
                var countQuery = new Kinvey.Query(countQueryOptions);

                self.dataStore.count(countQuery).toPromise().then(function (totalItemsCount) {
                    total = totalItemsCount;
                    shouldRefreshCount = false;
                    return self.dataStore.find(query).toPromise();
                }).then(function onSuccess(entities) {
                    options.success(entities);
                }).catch(function onErr(readError) {
                    options.error(readError);
                });

            } else {
                self.dataStore.find(query).toPromise().
                    then(function onSuccess(entities) {
                        options.success(entities);
                    }).catch(function onErr(err) {
                        options.error(err);
                    });
            }
        },
        update: function (options) {
            var methodOption = this.options.update;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var isMultiple = isArray(options.data.models);
            if (isMultiple) {
                var batchUpdateUnsupportedError = new Error(ERROR_MESSAGES.BatchUpdateNotSupportedMessage);
                options.error(batchUpdateUnsupportedError);
            } else {
                var itemForUpdate = options.data;

                this.dataStore.save(itemForUpdate).
                    then(function onSuccess(updateResult) {
                        options.success(updateResult);
                    }).catch(function onErr(updateErr) {
                        options.error(updateErr);
                    });
            }
        },
        create: function (options) {
            var methodOption = this.options.create;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var isMultiple = isArray(options.data.models);
            if (isMultiple) {
                var batchCreateUnsupportedError = new Error(ERROR_MESSAGES.batchCreateUnsupportedError);
                options.error(batchCreateUnsupportedError);
            } else {
                var createData = options.data;
                // TODO - check with batch create and other options
                if (!createData._id && createData._id === "") {
                    delete createData._id;
                }

                this.dataStore.save(createData).then(function onSuccess(createResult) {
                    shouldRefreshCount = true;
                    options.success(createResult);
                }).catch(function onErr(createError) {
                    options.error(createError);
                });
            }
        },
        destroy: function (options) {
            var methodOption = this.options.destroy;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }
            var methodHeaders;
            if (methodOption && methodOption.headers) {
                methodHeaders = methodOption.headers;
            }
            var isMultiple = isArray(options.data.models);
            if (isMultiple) {
                var batchDeleteUnsupportedError = new Error(ERROR_MESSAGES.BatchDeleteNotSupportedMessage);
                options.error(batchDeleteUnsupportedError);
            }

            this.dataStore.removeById(options.data._id)
                .then(function onSuccess(destroyResult) {
                    shouldRefreshCount = true;
                    options.success(destroyResult);
                }).catch(function onErr(destroyError) {
                    options.error(destroyError);
                });
        },
        parameterMap: function (options, type) {
            var result = kendo.data.transports.kinvey.parameterMap(options, type, true);
            return result;
        }
    });

    extend(true, kendo.data, {
        transports: {
            kinvey: kinveyTransport
        },
        schemas: {
            kinvey: {
                type: "json",
                total: function (data) {
                    return total ? total : data.length;
                },
                data: function (data) {
                    return data;
                },
                model: {
                    id: CONSTANTS.idField
                }
            }
        }
    });

    function translateKendoQuery(data) {
        var result = {};
        if (data) {
            if (data.skip) {
                result.skip = data.skip;
                delete data.skip;
            }
            if (data.take) {
                result.limit = data.take;
                delete data.take;

                // we only need the "limit" and "skip" modifiers, "page" and "pageSize" are not required on the server
                delete data.pageSize;
                delete data.page;
            }
            if (data.sort) {
                var sortExpressions = data.sort;
                var sort = {};
                if (!isArray(sortExpressions)) {
                    sortExpressions = [sortExpressions];
                }
                each(sortExpressions, function (idx, value) {
                    sort[value.field] = value.dir === 'asc' ? 1 : -1;
                });
                result.sort = sort;
                delete data.sort;
            }
            if (data.filter) {
                var filterOptions = data.filter;
                var kinveyFilterOptions = {};
                var logicalOperator = filterOptions.logic;

                var kendoFiltersArray = filterOptions.filters;
                var kinveyFiltersArray = [];

                var i, loopCount = kendoFiltersArray.length,
                currentKendoFilter, 
                currentKendoFilterOperator,
                currentKendoFilterFieldName,
                curretKendoFilterValue,
                currentKinveyFilter;

                for (i = 0; i < loopCount; i++) {
                    currentKendoFilter = kendoFiltersArray[i];
                    currentKendoFilterOperator = currentKendoFilter["operator"];
                    currentKendoFilterFieldName = currentKendoFilter.field;
                    curretKendoFilterValue = currentKendoFilter.value;
                    currentKinveyFilter = {};

                    switch (currentKendoFilterOperator) {
                        case "eq":
                            currentKinveyFilter[currentKendoFilterFieldName] = curretKendoFilterValue;
                            break;
                        case "neq":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$ne": curretKendoFilterValue
                            };
                            break;
                        case "isnull":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$eq": null
                            };
                            break;
                        case "isnotnull":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$ne": null
                            };
                            break;
                        case "lt":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$lt": curretKendoFilterValue
                            };
                            break;
                        case "gt":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$gt": curretKendoFilterValue
                            };
                            break;
                        case "lte":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$lte": curretKendoFilterValue
                            };
                            break;
                        case "gte":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$gte": curretKendoFilterValue
                            };
                            break;
                        case "startswith":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$regex": "^" + curretKendoFilterValue
                            };
                            break;
                        case "endswith":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$regex": curretKendoFilterValue + "$"
                            };
                            break;
                        default:
                            throw new Error("Unsupported filtering operator: " + currentKendoFilterOperator);
                    }
                    kinveyFiltersArray.push(currentKinveyFilter);
                }

                var kinveyFilterOptions = {};
                var kinveyLogicalOperator = logicalOperator === "and" ? "$and" : "$or";

                kinveyFilterOptions[kinveyLogicalOperator] = kinveyFiltersArray;

                delete data.filter;
                result.filter = kinveyFilterOptions;
            }
        }
        return result;
    }
}());
