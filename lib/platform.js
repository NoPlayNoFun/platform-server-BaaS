var baas = require("./baas.js");

var createStore = function(name, port, ip) {
	return baas.createStore(name, port, ip);
}

var createPlatformStore = function(name, port, ip) {
	return new Platform(name, port, ip);
}

var Platform = function(name, port, ip) {
	this._initialize(name, port, ip);
}

Platform.prototype._initialize = function(name, port, ip) {
	this.store = baas.createStore(name,port,ip);
	
	/*
		Upsert a document in a database. If no records match, one is created, otherwise the first
		matching record is updated.

		Warning: The side effect of the upsert is that the objectId (that is, BaaS's object ID)
		increments with every upsert. (The mongodb _id field is not affected.) Also the createdOn
		date will be set. In other words, it is treated as a remove followed by an insert.

		URL            /run/upsert/[store name]/
		Method         PUT
		Success        status 200
		Query String   ?{"where":{...}}
		Post Data      {"[column name]":[new value], ...}
	*/
	this.store.addRoute({
		method:"put",
		path:"upsert/{string}",		// upsert/<storeName>/
		status:200,
		authLevel:1,
		roles:{user:["*"], group:[1]},

		action:function(handler) {
			var storeName = handler.path[2];
			try {
				var data = JSON.parse(handler.data);
			}
			catch(err){
				handler.respondWithDefault("Bad Request");
				return;
			}
			try {
				var query = handler.queryString && JSON.parse(decodeURIComponent(handler.queryString)) || {};
			}
			catch(err){
				handler.respondWithDefault("Bad Request");
				return;
			}
			// Much of this code taken from BaaS's implementation of store.create(),
			// but uses findAndModify() instead of insert().
			handler.route.baas.connect(".store." + storeName, function(db, collection) {
				collection.find({_schema:{$ne:null}}, {_schema:1,_id:0}).limit(1).toArray(function(err, docs) {
					if(err) {
						return handler.route.baas.dbError(handler, db);
					}
					else if(docs.length==0){
						db.close();
						handler.respondWithDefault("Not Found");
					}
					else {
						var schema = docs[0]._schema;
						var count = 0;
						for(var value in data) {
							count++;
							if(schema[value]==undefined){
								count--;
								delete data[value];
								continue;
							}
							if(schema[value] == "array") {
								schema[value] = "object";
							}
							if(typeof data[value] != schema[value]) {
								db.close();
								handler.respondWithDefault("Bad Request");
								return;
							}
						}
					
						if(count == 0) {
							db.close();
							handler.respondWithDefault("Bad Request");
						}
						else{
							if(data._schema) {
								delete data._schema;
							}
							++schema._key;
							collection.update({_schema: {$ne:null}}, {$inc:{"_schema._key":1}}, {w:0});
							data.createdOn = new Date();
							data.updatedOn = data.createdOn;
							data.objectId = schema._key;

							collection.findAndModify(
								{"$and":[
									{"objectId": {"$ne": null}},
									query.where || {}
									]},
								[["objectId", "asc"]],
								{"$set": data},
								{
									"multi": false,
									"upsert": true,
									"new": true,
									"fields": {"objectId":1}
								},
								function(err, doc) {
									db.close();
									if(err) {
										handler.respondWithDefault("Internal Server Error");
									}
									else if(doc) {
										handler.status = 200;
										handler.respond({"objectId":doc.objectId});
									}
									else {
										handler.status = 404;
										handler.respondWithDefault("Not Found");
									}
								});
						}
					}
				});
			});
		}
	});
}

exports.createPlatformStore = createPlatformStore;
exports.createStore = createStore;


