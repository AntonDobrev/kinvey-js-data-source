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

    var $ = window.jQuery;
    var kendo = window.kendo;

    var extend = $.extend;
    var aggrSeparator = '_';

    var kinveyTransport = kendo.data.RemoteTransport.extend({
        init: function (options) {
            //  this.everlive$ = options.dataProvider || Everlive.$;

            //  this._subscribeToSdkEvents(options);
            if (!Kinvey) {
                throw new Error(ERROR_MESSAGES.NoKinveyInstanceMessage);
            }

            if (!options.typeName && !options.dataStore) {
                throw new Error(ERROR_MESSAGES.NoDataStoreCollectionNameMessage);
            }

            this.dataStore = options.dataStore ? options.dataStore : Kinvey.DataStore.collection(options.typeName, Kinvey.DataStoreType.Network);

            kendo.data.RemoteTransport.fn.init.call(this, options);
        },
        _crud: function(options, type) {
            var data = this.parameterMap(options.data, type);

            this.dataStore.count().subscribe(function(totalItemsCount){

    }, function(){
        throw new Error("Could not retrieve count");
    })
            return "_in crud";
        },

        read: function (options) {
            var methodOption = this.options['read'];
            var self = this;
            if (methodOption && methodOption.url) {
                return kendo.data.RemoteTransport.fn.read.call(this, options);
            }

           self._crud(options, "read");
            var queryOptions = translateKendoQuery(options.data);
            var query = new Kinvey.Query(queryOptions);

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

                console.log("Find completed");
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
        // parameterMap: function(options, type) {
        //     var result = kendo.data.transports.kinvey.parameterMap(options, type, true);

        //     return result;
        // }
    });

    
    extend(true, kendo.data, {
        transports: {
            kinvey: kinveyTransport
        },
        schemas: {
            kinvey: {
                type: 'json',
                // total: function (data) {
                //     return data.hasOwnProperty('count') ? data.count : data.Count;
                // },
                data: function (data) {
                    return data || Everlive._traverseAndRevive(data) || data; // TODO
                },
                model: {
                    id: CONSTANTS.idField
                }
           //     aggregates: 'aggregates'
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
                if (!$.isArray(sortExpressions)) {
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
                        case "contains":
                            // not supported 
                            currentKinveyFilter[currentKendoFilterFieldName] = {
                                "$regex": curretKendoFilterValue
                                //             "$options": "i" ONly case-sensitive
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

    var regexOperations = ['startswith', 'startsWith', 'endswith', 'endsWith', 'contains'];

    var filterBuilder = {
        build: function (filter) {
            return filterBuilder._build(filter);
        },
        _build: function (filter) {
            if (filterBuilder._isRaw(filter)) {
                return filterBuilder._raw(filter);
            }
            else if (filterBuilder._isSimple(filter)) {
                return filterBuilder._simple(filter);
            }
            else if (filterBuilder._isRegex(filter)) {
                return filterBuilder._regex(filter);
            }
            else if (filterBuilder._isAnd(filter)) {
                return filterBuilder._and(filter);
            }
            else if (filterBuilder._isOr(filter)) {
                return filterBuilder._or(filter);
            }
        },
        _isRaw: function (filter) {
            return filter.operator === '_raw';
        },
        _raw: function (filter) {
            var fieldTerm = {};
            fieldTerm[filter.field] = filter.value;
            return fieldTerm;
        },
        _isSimple: function (filter) {
            return typeof filter.logic === 'undefined' && !filterBuilder._isRegex(filter);
        },
        _simple: function (filter) {
            var term = {}, fieldTerm = {};
            var operator = filterBuilder._translateoperator(filter.operator);
            if (operator) {
                term[operator] = filter.value;
            }
            else {
                term = filter.value;
            }
            fieldTerm[filter.field] = term;
            return fieldTerm;
        },
        _isRegex: function (filter) {
            return $.inArray(filter.operator, regexOperations) !== -1;
        },
        _regex: function (filter) {
            var fieldTerm = {};
            var regex = filterBuilder._getRegex(filter);
            fieldTerm[filter.field] = filterBuilder._getRegexValue(regex);
            return fieldTerm;
        },
        _getRegex: function (filter) {
            var pattern = filter.value;
            var filterOperator = filter.operator;
            switch (filterOperator) {
                case 'contains':
                    return new RegExp(".*" + pattern + ".*", "i");
                case 'startsWith': // removing the camel case operators will be a breaking change
                case 'startswith': // the Kendo UI operators are in lower case
                    return new RegExp("^" + pattern, "i");
                case 'endsWith':
                case 'endswith':
                    return new RegExp(pattern + '$', 'i');
            }
            throw new Error('Unknown operator type.');
        },
        _getRegexValue: function (regex) {
            return QueryBuilder.prototype._getRegexValue.call(this, regex);
        },
        _isAnd: function (filter) {
            return filter.logic === 'and';
        },
        _and: function (filter) {
            var i, l, term, result = { $and: [] };
            var operands = filter.filters;
            for (i = 0, l = operands.length; i < l; i++) {
                term = filterBuilder._build(operands[i]);
                result.$and.push(term);
            }
            return result;
        },
        _isOr: function (filter) {
            return filter.logic === 'or';
        },
        _or: function (filter) {
            var i, l, term, result = [];
            var operands = filter.filters;
            for (i = 0, l = operands.length; i < l; i++) {
                term = filterBuilder._build(operands[i]);
                result.push(term);
            }
            return { $or: result };
        },
        _translateoperator: function (operator) {
            switch (operator) {
                case 'eq':
                    return null;
                case 'neq':
                    return '$ne';
                case 'gt':
                    return '$gt';
                case 'lt':
                    return '$lt';
                case 'gte':
                    return '$gte';
                case 'lte':
                    return '$lte';
            }
            throw new Error('Unknown operator type.');
        }
    };

    // /**
    //  * Get a Kendo UI DataSource that is attached to the current instance of the SDK with default options.
    //  * @method getKendoDataSource
    //  * @memberOf Everlive.prototype
    //  * @param {String} typeName The corresponding type name for the DataSource.
    //  * @param {Object} [options] Additional DataSource options.
    //  * @returns {DataSource}
    //  */
    // var _getKendoDataSource = function (typeName, dataStore, options) {
    //     options = options || {};
    //     // TODO - check for Kinvey options here
    //     // var everlive$ = options.dataProvider || Everlive.$;
    //     // if (!everlive$) {
    //     //     throw new Error('You need to instantiate an Everlive instance in order to create a Kendo UI DataSource.');
    //     // }
    //     // if (!typeName) {
    //     //     throw new Error("You need to specify a 'typeName' in order to create a Kendo UI DataSource.");
    //     // }
    //     if (options.serverGrouping) {
    //         throw new Error("serverGrouping is not supported.");
    //     }
    //     if (options.serverAggregates) {
    //         throw new Error("The serverAggregates option is not supported");
    //     }

    //     // TODO - Add a parameter for the dataStore instance here - check this and in createDataSource
    //     var defaultKinveyOptions = {
    //         type: 'kinvey',
    //         transport: {
    //             typeName: typeName,
    //             dataStore: dataStore
    //         }
    //     };

    //     //  var options = _.defaults(defaultEverliveOptions, options); // TODO
    //     var dataSourceOptions = Object.assign(defaultKinveyOptions, options); 

    //     return new kendo.data.DataSource(dataSourceOptions);
    // };

    // /**
    //  * Creates a new Kendo UI [DataSource](http://docs.telerik.com/kendo-ui/api/javascript/data/datasource) that manages a certain Backend Services content type.
    //  * Kendo UI [DataSource](http://docs.telerik.com/kendo-ui/api/javascript/data/datasource) is used in conjunction with other Kendo UI widgets (such as [ListView](http://docs.telerik.com/kendo-ui/web/listview/overview) and [Grid](http://docs.telerik.com/kendo-ui/web/grid/overview)) to provide an easy way to render data from Backend Services.
    //  * *including Kendo UI scripts is required*.
    //  * @param options data source options. See the Kendo UI documentation for [DataSource](http://docs.telerik.com/kendo-ui/api/javascript/data/datasource) for more information.
    //  * @param options.transport.typeName The collection name in Kinvey that will be managed.
    //  * @param options.transport.dataStore An instance of a [DataStore](https://devcenter.kinvey.com/phonegap/guides/datastore#SpecifyDataStoreType) that will be used by the data source 
    //  * @returns {DataSource} A new instance of Kendo UI DataSource. See the Kendo UI documentation for [DataSource](http://docs.telerik.com/kendo-ui/api/javascript/data/datasource) for more information.
    //  * @example ```js
    //  * var booksDataSource = Everlive.createDataSource({
    //      *   transport: {
    //      *     typeName: 'Books'
    //      *   }
    //      * });
    //  * ```
    //  */
    // var createDataSource = function (options) {
    //     options = options || {};
    //     return _getKendoDataSource(options.typeName, options.dataStore, options);
    // };
}());