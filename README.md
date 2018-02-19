# Kinvey Kendo UI DataSource

The Kinvey flavour of the [Kendo UI DataSource](http://docs.telerik.com/kendo-ui/api/framework/datasource) component (named `'kinvey'`), supports filtering, sorting, paging, and CRUD operations. Below are samples and explanations how to configure these features.

- [Sourcing the Component](#sourcing-the-component)
- [Adding References](#adding-references)
- [Initializing](#initializating)
- [Filtering](#filtering)
- [Sorting](#sorting)
- [Paging](#paging)
- [Unsupported Options](#unsupported-configuration-options) 

## Sourcing the Component

You can choose between several ways of sourcing the Backend Services JavaScript SDK SDK files, including downloading a local copy or directly referencing an online copy.

### Online Copy

For easy setup, you can directly reference the SDK from a Content Delivery Network (CDN).

> For production apps, we recommend that you install a local copy of the package inside your application. Doing so ensures that the SDK will instantiate even without a network connection.

????? Link here

### GitHub Repository

The source code of the component can be accessed in the following [GitHub repository](https://github.com/Kinvey/kinvey-kendo-data-source).

## Adding References

```
<!-- Kendo UI Core / Kendo UI Professional -->
<script src="kendo.all.min.js"></script>

<!-- Kinvey JS SDK (HTML, PhoneGap, etc.) -->
<script src="...."></script>

<!-- Kinvey Kendo Data Source -->
<script src="kendo.data.kinvey.js"></script>
```

## Initializing

In order to use the `kinvey` data source dialect, the global **Kinvey** object should be initialized. [Here](https://devcenter.kinvey.com/phonegap/guides/getting-started) you can learn how to initialize it in your app. 

You can intialize the connection to the backend by specifying either a collection name or by passing an instance of the Kinvey data store object.

> Before initializing the Data Source instance ensure you have reviewed the [Kinvey Data Store Guide](https://devcenter.kinvey.com/phonegap/guides/datastore)  and are familiar with how the DataStore types in Kinvey work.

### Initialize with Collection Name

You can connect a data source instance directly to a given collection in the backend by simply supplying the name of that collection to the `transport.typeName` setting. 

When initialized in that way the data source will use internally a Kinvey Data Store of type `Network`. 

```javascript
var collectionName = "books";

var dataSourceOptions = {
    type: "kinvey",
    transport: {
        typeName: collectionName
    },
    schema: {
        model: {
            id: "_id"
        }
    },
    error: function(err) {
        alert(JSON.stringify(err));
    }
};

var dataSource = new kendo.data.DataSource(dataSourceOptions);
```

### Initialize with a Data Store Instance

For advanced scenarios like caching or offlynce synchronization you will need to manage a Kinvey data store of type `Cache` or `Sync`. You can instruct the data source instance to work directly with such data store. You have to manage yourself the state of the store and `push`, `pull` and `sync` the entities to/from the server yourself in a suitable place of your application. The data source instance will only fetch the items that are available locally in the data store. 

```JavaScript
// initialize the data store 
var booksSyncStore = Kinvey.DataStore.collection(collectionName, Kinvey.DataStoreType.Sync); 
 
// pull and push items to/from the server 

// initialize the data source with the 
var dataSourceOptions = {
    type: "kinvey",
    transport: {
        dataStore: booksSyncStore-
    },
    schema: {
        model: {
            id: "_id"
        }
    },
    error: function(err) {
        alert(JSON.stringify(err));
    }
};

var dataSource = new kendo.data.DataSource(dataSourceOptions);
```

> For the data store of type `Cache`  the data source is calling the server directly and will not . 

## Filtering

The filtering is enabled by passing `true` to the `serverFiltering` configuration option and passing a filter object to the `filter` option. 

The dialect supports a selected subset of the DataSource filter [configuration](http://docs.telerik.com/kendo-ui/api/framework/datasource#configuration-filter) operators, namely:

- `"eq"`


-  `"neq"`
- `"isnull"`
- `"isnotnull"`
-  `"lt"`
- `"gt"`
- `"lte"`
- `"gte"`
- `"startswith"`
- `"endswith"`

```javascript
var dataSourceOptions ={
    type: 'kinvey',
    // ommitted for brevity
    serverFiltering: true,
    filter: { field: 'Author', operator: 'eq', value: 'Lee' }
}
```

In addition to the standard Kendo UI Data Source filtering operatiors, this dialect adds support for the following Kinvey-specific operators:

- `"isin"`&mdash;value is an array of possible matches. Ex: `{ field: 'author', operator: 'isin', value: ["Author1", "Author2", "Author3"] }`
- `"isnotin"`&mdash;an inversion of the above logic returning all matches that are not in the specified array. 

## Sorting

The sorting is enabled by passing `true` to the `serverSorting` configuration option and passing a sort object to the `sort` option. The dialect supports all DataSource sorting [configuration](http://docs.telerik.com/kendo-ui/api/framework/datasource#configuration-serverSorting) options.

```javascript
var dataSourceOptions = {
    type: 'kinvey',
    // ommitted for brevity
    serverSorting: true,
    sort: { field: 'Author', dir: 'asc' }
}
```

## Paging

The paging is enabled by passing `true` to the `serverPaging`. 

Usually you have to specify only the `pageSize` configuration option. You can also specify the `page` option to request a specific page. The dialect supports all DataSource paging [configuration](http://docs.telerik.com/kendo-ui/api/framework/datasource#configuration-serverPaging) options.

```javascript
var dataSourceOptions = {
    type: 'kinvey',
    // ommitted for brevity
    serverPaging: true,
    pageSize: 20
};
```

> When `serverPaging` is enabled, a separate request to determine the count of the entities on the server is made before requesting the respective page of entities from the server. 

### Unsupported Configuration Options

The following configuration options of the `DataSource` component are not supported for server execution in {{site.tap}}. By default, their value is set to `false`. This means that grouping and aggregation of data must be done client-side.

- [`batch`](http://docs.telerik.com/kendo-ui/api/framework/datasource#configuration-batch)
- [`serverGrouping`](http://docs.telerik.com/kendo-ui/api/framework/datasource#configuration-serverGrouping)&mdash;you can use client-side grouping instead
- Filter operators that are not supported for server filtering are: `contains`, `doesnotcontain`, `isempty`, `isnotempty`
- Specifying a subset of fields to be returned
- Expand expressions
- [`transport.parameterMap`](http://docs.telerik.com/kendo-ui/api/javascript/data/datasource#configuration-transport.parameterMap)&mdash;you can use the [beforeExecute]({% slug js-sdk-querying-events %}#beforeexecute) event instead to mimic the functionality

### License

```
See [LICENSE](LICENSE) for details.
```
