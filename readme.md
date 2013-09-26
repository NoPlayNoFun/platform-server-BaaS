# Node BaaS
Store is a permissions level server-side data store with a RESTful API. 

## Setup 

   * Install and start mongoDB ([More info](http://docs.mongodb.org/manual/installation/))
   
   * Install `BaaS`
    
        npm install baas

   * Create a `main.js` file. This is the file you will use to configure baas
  
```javascript

        var baas = require("baas");
        var store = baas.createStore("window",8080,"127.0.0.1");
```

  * run `node main.js`

  * Create an admin account by sending a `POST` request to `http://127.0.0.1:8080/setup` with data `{"username":"[username]","password":"[password]"}`

  Your store is now ready to configure/run. To view/edit the data go to `http://127.0.0.1:8080/sandbox`

## Configure

### store.allowUserActivation

Boolean. Default `true`. If true, will send an email to recipient upon user creation.

### store.loginAllowedType

Flag indicating whether to allow for email and/or username as a value for the user login. 

`baas.ALLOW_USERNAME_EMAIL` (Default)

`baas.ALLOW_USERNAME`

`baas.ALLOW_EMAIL`

### store.setMongoDB(host, port)

 By default, the mongoDB host and port are set based on the local system environment variable. Otherwise use this method to set a custom host and port. 

### store.configureSMTP(email, password)
 `email` Email address

 `password` base-64 encoded password

### store.setTemplateForgotPassword(from, subject, htmlBody, textBody)
  
  `from` Email address sender. Default `null`

  `subject` Message subject

  `htmlBody` Rich-text message body

  `textBody` Plain-text message body

### store.setTemplateActivate(from, subject, htmlBody, textBody, complete)
 
  `from` Email address sender. Default `null`

  `subject` Message subject

  `htmlBody` Rich-text message body

  `textBody` Plain-text message body

  `complete` URL forward upon activation

### store.addRoute(routeObject)

Allows you to create custom rest calls. See [Custom routes]() for more info


# &nbsp;
# REST Reference

##Store



###Create new store 
 
*Admin only*

URL `/store/`

Method `POST`

Success status `201`

######Post Data
     {"name":"[store name]", "schema":{"[column name]":"[type]"}, "roles":{"get":{"user":[user objectIds], "group":[group objectIds]}}}

>`name` The store name

>`schema` An object containing column name keys and type values used for validation when entering store data. Valid types are `string` `number` `boolean` `array` and `object`.  
>
> *Example* `{"column1":"string","column2":"boolean","column3":"array"}`

> `roles` An object containing method keys (`get`,`post`,`put`,`delete`,`query`) and object values. Those objects can contain `user` or `group` keys, and array values containing objectIds and allow strings `"*"` for any/all access to the method, and `"."` for any logged in user to access the method.  
> 
> *Example* `{"get":{"user":[1,3,28],"group":[4,5]}, "put":{"user":["."]}}` Meaning users 1,3,28 and any members of groups 4 and 5 can call the `get` method for this store, and any logged in user can call the `put` method for this store. 

###Update existing store

*Admin only*

URL `/store/[store name]/`

Method `PUT`

Success status `200`

######Post Data
     {"schema":{"[column name]":"[type]"}, "roles":{"get":{"user":[user objectIds], "group":[group objectIds]}}}

>`schema` (Optional) Modify or add column names and types to the store. *See Create new store*

> `roles` (Optional)  An object containing method keys (`get`,`post`,`put`,`delete`,`query`) and object values. Those objects can contain `user` or `group` keys, and array values containing objectIds and allow strings `"*"` for any/all access to the method, and `"."` for any logged in user to access the method.  
> 
> *Example* `{"get":{"user":[-1,-3,29],"group":[-4,-5]}, "put":{"user":["-."]}}` Meaning users 1,3 and any members of groups 4 and 5 can no longer call the `get` method and user 29 can call the `get` method for this store, and any logged in user can no longer call the `put` method for this store. 

###Get store names

*Admin only*

URL `/store/`

Method `GET`

Success status `200`

Returns an array of store names.

### Add object to store


URL `/store/[store name]/`

Method `POST`

Success status `201`

######Post Data
An object represented by the schema values set when a store is created. 

    {"[column name]":[value], "[another column name]":[value]}

If value doesn't match schema type, status will return a `400` bad request.

### Get object from store

URL `/store/[store name]/[object id]/`

Method `GET`

Success status `200`

Returns the requested object


### Update object in store

URL `/store/[store name]/[object id]/`

Method `PUT`

Success status `200`

######Post Data
An object represented by the schema values set when a store is created. 

    {"[column name]":[new value]}

If value doesn't match schema type, status will return a `400` bad request.

### Query objects from store

URL `/store/[store name]/`

Method `GET`

Success status `200`

Returns an array of objects based on the query qualifications

######Query string

    ?{"where":{"$ne":null}, "limit":1, "skip":3, "sort":{"[column name]":1},"count":false,"select":{"[column name]":1}}


`where` (Optional) A query object. See [Query operators](j) for more info

`limit` (Optional) Limits the amount of objects to this number

`skip` (Optional) A number for how many objects to skip over

`count` (Optional) A boolean. If true, return object count instead

`select` (Optional) Only return objects with specfic column names denoted in this object


### Delete object from store

URL `/store/[store name]/[object id]/`

Method `DELETE`

Success status `200`

Returns a HTTP status of `404 Not Found` if object doesn't exist 

### Get info for store

*Admin only*

URL `/store/[store name]/info/`

Method `GET`

Success status `200`

Returns the `roles` and `schema` objects

## Users

### Login

URL `/user/login/`

Method `POST`

Success status `200`

Returns an object containing the user object id and a session key, and sends a session cookie.

Logging in can be accomplished in one of two ways:

######Post Data

    {"user":"[user or email]", "password":"[user password]"}

or

######Authorization Header

    Authorization: Basic [base64 of user name and password]


###Log out 

URL `/user/logout/`

Method `GET`

Success status `200`

Sends an expired null session cookie. 


###Create new user

URL `/user/`

Method `POST`

Success status `201`

######Post Data

    {"username":"[user name]", "password":"[user password]", "email":"[email address]", "admin":false}

`username` Sets the user name

`password` Sets the password

`email` Sets the email

`Admin` (Optional) *Must be an admin to set this value*. Makes user an admin. 

###Update user

URL `/user/[user id]/`

Method `PUT`

Success status `200`

Updates user object values. Must be logged in as the requesting user, or an admin. 

See [Update object in store](todo) for more info


###Get user 

URL `/user/[user id]/`

Method `GET`

Success status `200`

Returns a store object representing user information. Must be logged in as the requesting user, or an admin. 

###Query users

*Admin only*

URL `/user/`

Method `GET`

Success status `200`

Returns an array of user objects based on the query filter. See [Query objects from store](todo) for more info


### Delete user

URL `/user/[user id]/`

Method `DELETE`

Success status `200`

Deletes the user. Must be logged in as the requesting user, or an admin. 

### Activate user

URL `/user/activate`

Method `GET`

Success status `200`

Activates a user associated with a certain activation code

######Query string 

    ?[activation code]

###Forgot password

URL `/user/forgotpassword/`

Method `GET`

Success status `200`

Sends a temporary one-time-use password to requested email address

###### Query string

    ?{"email":"[user email]"}


## Groups

Groups are collections of users for the purpose of allowing its members to access permission-level based api calls. 

### Create new group

*Admin only*

URL `/group/`

Method `POST`

Success status `201`

######Post Data

    {"users":[0,1,2], "name":"[group name]"}

`users` An array of users representing the group

`name` (Optional) The name of the group


### Update group

*Admin only*

URL `/group/[group id]/`

Method `PUT`

Success status `200`

Updates group object values. See [Update object in store](todo) for more info

### Query groups

*Admin only*

URL `/group/`

Method `GET`

Success status `200`

Returns an array of group objects based on the query filter. See [Query objects from store](todo) for more info

### Delete a group

*Admin only*

URL `/group/[group id]/`

Method `DELETE`

Success status `200`

## Custom routes

The previous set of methods listed above are the building blocks for building customized RESTful APIs. Custom routes can build on top of these building blocks. 

To add a custom route, you'll use the following method in your `main.js` file. 

##### store.addRoute(routeObject)

**`routeObject`** requires the following values to be set:

  `method` The http method needed to call this route

  `path` The http path to be called. See dREST's [route path conditions](https://github.com/jjbateman/dREST/blob/master/Documentation.md#route-path-conditions) for more info

  `status` The default return http status code

  `roles` Object containing the users and/or groups that can call this route

  `action` 


The following example uses the url path to limit how many results are returned. The returning objects are from a store called "abc", and each object only contains the "createdOn" value:

```javascript 
     
    var customRoute = store.addRoute({
		method:"get",
		path:"abcCreatedOn/{number}",
		status:200,
		roles:{user:["*"], group:[1]},

		action:function(handler) {
			var howMany = parseInt(handler.path[2]);
			handler.save();  //saves the handler state
			handler.path = ["store","abc"];
			handler.queryString = JSON.stringify( {limit:howMany, select:{createdOn:1}} );
			handler.store.query(handler,function(handler, r) {
				handler.restore(); //restores the handler state to the previous save
				
				handler.respond(r);
			});
		}
    });

```

This example can be run by sending a `GET` request to `http://[server]/run/abcCreatedOn/[max number of results]/` 



## Query operators

###Comparison

####$all 

Matches arrays that contain **all** elements specified in the query.

The following example selects any object from the "abc" store where the "zyx" column array contains the elements "a", "b", and "d":

`http://localhost/store/abc/?{"where":{"zyx":{"$all":["a","b","d"]}}}`

####$gt

Matches values that are **greater than** the value specified in the query.

The following example selects any object from the "abc" store where the "d" column contains a number greater than 7:

`http://localhost/store/abc/?{"where":{"d":{"$gt":7}}}`

####$lt

Matches values that are **less than** the value specified in the query.

The following example selects any object from the "abc" store where the "e" column contains a number less than 100:

`http://localhost/store/abc/?{"where":{"e":{"$lt":100}}}`

####$lte

Matches values that are **less than or equal to** the value specified in the query.

The following example selects any object from the "abc" store where the "f" column contains a number less than or equal to 50:

`http://localhost/store/abc/?{"where":{"f":{"$lte":50}}}`

####$ne

Matches all values that are **not equal** to the value specified in the query.

The following example selects any object from the "abc" store where the "g" column contains a value that is not null:

`http://localhost/store/abc/?{"where":{"g":{"$ne":null}}}`

####$nin 

Matches values that do not exist in an array specified to the query.

The following example selects any object from the "abc" store where the "zyx" column array does not contain the elements "a", "b", and "d":

`http://localhost/store/abc/?{"where":{"zyx":{"$nin":["a","b","d"]}}}`


### Logical 

####$and

Joins query clauses with a logical **AND**, returns all objects that match the conditions of both clauses.

The following example selects any object from the "abc" store where the "d" column contains a number greater than 2 **and** less than 99:

`http://localhost/store/abc/?{"where":{"$and":[{"d":{"$gt":2}},{"d":{"$lt":99}}]}}`

####$nor	

Joins query clauses with a logical **NOR**, returns all objects that fail to match both clauses

