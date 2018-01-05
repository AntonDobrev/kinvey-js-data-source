(function () {
    'use strict';

    // TODO
    // count
    // offline?
    // backendInstance - n/a
    // serverPagination with 10 000 items?
    // support Cache and Sync stores
    // replace throw new error with options.error()
    // only timeout option? - https://devcenter.kinvey.com/phonegap/guides/datastore#SpecifyDataStoreType 
    var ERROR_MESSAGES = {
        "NoKinveyInstanceMessage": "An instance of the Kinvey JavaScript SDK must be initialized",
        "NoDataStoreCollectionNameMessage": "'A collection name or a data store instance must be provided.'"
    }

    var CONSTANTS = {
        idField: "_id"
    }

    if (typeof window !== 'undefined' && typeof window.jQuery === 'undefined' || typeof window.kendo === 'undefined' || !window.kendo.data) {
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
            var methodOption = this.options['read'];
            var self = this;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var queryOptions = {};
            queryOptions = translateKendoQuery(options.data);
            var query = new Kinvey.Query(queryOptions);

            if (options.data.skip >= 0 || options.data.take >= 0 || shouldRefreshCount) {
                var countQueryOptions = {};
                countQueryOptions.filter = queryOptions.filter; // we need this to send only the filter to the server for the count query
                var countQuery = new Kinvey.Query(countQueryOptions);

                self.dataStore.count(countQuery).toPromise().then(function (totalItemsCount) {
                    total = totalItemsCount;

                    shouldRefreshCount = false;
                    return self.dataStore.find(query).toPromise();
                }).then(function onSuccess(entities) {
                    options.success(entities);
                }).catch(function onErr(err) {
                    options.error(err);
                });

            } else {
                self.dataStore.find(query).toPromise().
                    then(function onSuccess(entities) {
                        options.success(entities);
                    }).catch(function onErr(err) {
                        options.error(err);
                    });
            }

            // TODO ???? do we need this
            // var id = options.data.Id;

            // if (id) {
            //     this.dataCollection.withHeaders(this.headers).withHeaders(methodHeaders).getById(id).then(options.success, options.error);
            // } else {
            //     this.dataCollection.withHeaders(this.headers).withHeaders(methodHeaders).get(everliveQuery)
            //         .then(function (getResult) {
            //             return self._readServAggregates(getResult, query, options, methodHeaders);
            //         })
            //         .then(options.success).catch(options.error);
            // }
        },
        update: function (options) {
            var methodOption = this.options['update'];
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var isMultiple = isArray(options.data.models);
            if (isMultiple) {
                throw new Error('Batch update is not supported.');
            } else {
                var itemForUpdate = options.data;

                this.dataStore.save(itemForUpdate).
                    then(function onSuccess(updateResult) {
                        options.success(updateResult);
                    }).catch(function onErr(updateErr) {
                        options.error(err);
                    });
            }
        },
        create: function (options) {
            var methodOption = this.options['create'];
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var isMultiple = isArray(options.data.models);
            if (isMultiple) {
                throw new Error('Batch insert is not supported.');
            } else {
                var createData = options.data;
                // TODO - check with batch create and other options
                if (!createData._id && createData._id === "") {
                    delete createData._id;
                }
                // TODO - if I create an item and then update it - it is again created in the server???? BUG or perhaps only with the Cache store or was with the binding??
                this.dataStore.save(createData).then(function onSuccess(createResult) {
                    shouldRefreshCount = true;
                    options.success(createResult);
                }).catch(function onErr(createError) {
                    options.error(createError);
                });
            }
        },
        destroy: function (options) {
            var methodOption = this.options['destroy'];
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }
            var methodHeaders;
            if (methodOption && methodOption.headers) {
                methodHeaders = methodOption.headers;
            }
            var isMultiple = isArray(options.data.models);
            if (isMultiple) {
                throw new Error('Batch destroy is not supported.');
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
                type: 'json',
                total: function (data) {
                    return total ? total : data.length;
                },
                data: function (data) {
                    return data || Everlive._traverseAndRevive(data) || data; // TODO
                },
                model: {
                    id: CONSTANTS.idField // TODO - do we need the model here
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
                // optional - we only need the "limit" and "skip" modifiers
                delete data.pageSize;
                delete data.page;

                result.limit = data.take;
                delete data.take;
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

                var i, loopCount = kendoFiltersArray.length;

                for (i = 0; i < loopCount; i++) {
                    var currentKendoFilter = kendoFiltersArray[i]; // {"field":"Author","operator":"eq","value":"FD"}
                    var currentKendoFilterOperator = currentKendoFilter["operator"]; // "eq"
                    var currentKendoFilterFieldName = currentKendoFilter.field;
                    var curretKendoFilterValue = currentKendoFilter.value;

                    var currentKinveyFilter = {};
                    switch (currentKendoFilterOperator) {
                        case "eq":
                            currentKinveyFilter[currentKendoFilterFieldName] = curretKendoFilterValue
                            break;
                        case "neq":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$ne": curretKendoFilterValue
                            }
                            break;
                        case "isnull":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$eq": null
                            }
                            break;
                        case "isnotnull":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$ne": null
                            }
                            break;
                        case "lt":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$lt": curretKendoFilterValue
                            }
                            break;
                        case "gt":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$gt": curretKendoFilterValue
                            }
                            break;
                        case "lte":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$lte": curretKendoFilterValue
                            }
                            break;
                        case "gte":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$gte": curretKendoFilterValue
                            }
                            break;
                        case "startswith":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$regex": "^" + curretKendoFilterValue
                                //             "$options": "i" ONly case-sensitive
                            }
                            break;
                        case "endswith":
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$regex": curretKendoFilterValue + "$"
                            }
                            break;
                        default:
                            throw new Error("Unsupported filtering operator: " + currentKendoFilterOperator);
                            break;
                    }
                    kinveyFiltersArray.push(currentKinveyFilter);
                }

                var kinveyFilterOptions = {};
                var kinveyLogicalOperator = logicalOperator === "and" ? "$and" : "$or";

                kinveyFilterOptions[kinveyLogicalOperator] = kinveyFiltersArray

                delete data.filter;
                result.filter = kinveyFilterOptions;
            }
        }
        return result;
    }
}());
