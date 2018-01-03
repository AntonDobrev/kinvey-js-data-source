(function () {
    'use strict';

    // TODO
    // count
    // offline?
    // backendInstance - n/a
    // "contains" - n/a
    // serverPagination with 10 000 items?
    // support Cache and Sync stores
    // TODO - Add a parameter for the dataStore instance here

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
    total = null; 

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
        _setTotal: function(options, type, query) {
            var data = this.parameterMap(options.data, type); // TODO

          // if(query){
            this.dataStore.count(query).subscribe(function(totalItemsCount){
                total = totalItemsCount;
    }, function(){
        throw new Error("Could not retrieve count");
    })
        },
        // total: function() {
        //         var count = 0;
        //         this.dataStore.count().subscribe(function(totalItemsCount){
        //             count = totalItemsCount;
        //         }, function(){
        //             throw new Error("Could not retrieve count");
        //         })
                    
        //     },
        read: function (options) {
            var methodOption = this.options['read'];
            var self = this;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

          
        
            var queryOptions = translateKendoQuery(options.data);
            var query = new Kinvey.Query(queryOptions);

             if(options.data.skip >= 0 || options.data.take >= 0){ // TODO - options.data may not exist
                var countQuery = new Kinvey.Query(queryOptions.filter);
                 self._setTotal(options, "read", query);
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

            var stream = this.dataStore.find(query);
            stream.subscribe(function onNext(entities) {
                options.success(entities);
            }, function onError(err) {
                options.error(err);
            }, function onComplete(completed) {
            });

        },
        update: function (options) {
            var methodOption = this.options['update'];
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

            var isMultiple = Array.isArray(options.data.models);
            if (isMultiple) {
                throw new Error('Batch update is not supported.');
            } else {
                var itemForUpdate = options.data;

                /// TODO ??? why hould we bind to itemForUpdate?
                return this.dataStore.save(itemForUpdate).then(options.success.bind(this, itemForUpdate), options.error).catch(options.error);
            }
        },
        create: function (options) {
            var methodOption = this.options['create'];
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }
           
            var isMultiple = Array.isArray(options.data.models);

            if (isMultiple) {
                throw new Error('Batch insert is not supported.');
            } else {
                var createData = options.data;

                // TODO - check with batch create and other options
                if (!createData._id && createData._id === "") {
                    delete createData._id;
                }

                // TODO chech why at Create in the grid it suggests Update whether it should be suggesting "Create" - has something to do with the _id or the traverse and review function
                // TODO - if I create an item and then update it - it is again created in the server???? BUG or perhaps only with the Cache store or was with the binding??
                return this.dataStore.save(createData).then(options.success.bind(this, createData), options.error).catch(options.error);
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
            var isMultiple = Array.isArray(options.data.models);
            if (isMultiple) {
                throw new Error('Batch destroy is not supported.');
            }

            return this.dataStore.removeById(options.data._id)
                .then(options.success, options.error).catch(options.error);
        },
        parameterMap: function(options, type) {
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
                parse: function(response){
                    return response;
                },
                model: {
                    id: CONSTANTS.idField
                }
            }
        }
    });

    function translateKendoQuery(data) {

        /**
   * Create an instance of the Query class.
   *
   * @param {Object} options Options
   * @param {string[]} [options.fields=[]] Fields to select.
   * @param {Object} [options.filter={}] MongoDB query.
   * @param {Object} [options.sort={}] The sorting order.
   * @param {?number} [options.limit=null] Number of entities to select.
   * @param {number} [options.skip=0] Number of entities to skip from the start.
   * @return {Query} The query.
   */

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
                if (!Array.isArray(sortExpressions)) {
                    sortExpressions = [sortExpressions];
                }
                $.each(sortExpressions, function (idx, value) {
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
