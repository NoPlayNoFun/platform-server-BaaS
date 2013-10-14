var drest = require("drest");
var mongo = require('mongodb');
var nodemailer = require("nodemailer");

var http = require('http');
var format = require('util').format;
var crypto = require('crypto');
var fs = require('fs');

var Connection = mongo.Connection;
var Db = mongo.Db; 

var dhost = process.env['MONGO_NODE_DRIVER_HOST'] != null ? process.env['MONGO_NODE_DRIVER_HOST'] : 'localhost';
var dport = process.env['MONGO_NODE_DRIVER_PORT'] != null ? process.env['MONGO_NODE_DRIVER_PORT'] : Connection.DEFAULT_PORT;

drest.Router.prototype._addRoute = drest.Router.prototype.addRoute;
drest.Router.prototype.addRoute = function(obj, callback ) {
	var r = this._addRoute(obj);
	r.baas = obj.baas;
	return r;
}

drest.Handler.prototype._respond = drest.Handler.prototype.respond;
drest.Handler.prototype.respond = function(obj, callback) {
	this.addHeader("Cache-Control", "max-age=0");
	if(typeof callback == "function") {
		callback(this, obj);
	}else{
		this._respond(obj);
	}
}

drest.Handler.prototype._respondWithDefault = drest.Handler.prototype.respondWithDefault;
drest.Handler.prototype.respondWithDefault = function(obj, arg2) {
	if(typeof arg2 == "function") {
		arg2(this, obj);
	}else{
		this._respondWithDefault(obj,arg2);
	}
}

drest.Router.prototype.__doRoute = drest.Router.prototype._doRoute;
drest.Router.prototype._doRoute = function(req, res, data) {
	try {
		this.__doRoute(req, res, data);
	} catch(ex) {
		res.writeHead(500, []);
		res.end("");
	}
}

var createStore = function(name, port, ip) {
	return new Baas(name, port, ip);
}

var Baas = function(name, port, ip) {
	this._initialize(name, port, ip);
}

Baas.ALLOW_USERNAME_EMAIL = 0;
Baas.ALLOW_USERNAME = 1;
Baas.ALLOW_EMAIL = 2;

Baas.prototype._initialize = function(name, port, ip) {
	this.router = drest.createRouter(port, ip);
	this.name = name;
	this.externalUrl = "http://"+ip+":"+port;
	this.allowUserActivation = true;
	this.loginAllowedType = Baas.ALLOW_USERNAME_EMAIL;
	
	this._dhost = dhost;
	this._dport = dport;
	
	this.setTemplateForgotPassword(
		null,
		"Forgot Password",
		"<p>A temporary password has been set. You may only use it once. #{password}</p>",
		"A temporary password has been set. You may only use it once.  #{password}",
		this.externalUrl+"/message?"
	);
	this.setTemplateActivate(
		null,
		"Activate Account",
		"<p>Welcome #{handler.data.username}! Activate your account here: <a href='#{handler.route.baas.externalUrl}/user/activate?#{handler.data.activateCode}'>#{handler.route.baas.externalUrl}/user/activate?#{handler.data.activateCode}</a></p>",
		"Welcome #{handler.data.username}! Activate your account here: #{handler.route.baas.externalUrl}/user/activate?#{handler.data.activateCode}",
		this.externalUrl+"/message?User activated",
		this.externalUrl+"/message?Not found"
	);
	
	this.router.setAuthLayer(function(passthrough) {
		passthrough.route.baas.auth.getUser(passthrough);
	});
	
	this.router.addRoute({
		method:"post",
		path:"store/{string}",
		authLevel:1,
		status:201,
		action:this.api.store.create,
		authAction:this.auth.checkRoles,
		baas:this
	});
	
	this.router.addRoute({
		method:"get",
		path:"store/{string}/{number}",
		authLevel:1,
		status:200,
		action:this.api.store.retrieve,
		authAction:this.auth.checkRoles,
		baas:this
	});
	
	this.router.addRoute({
		method:"get",
		path:"store/{string}/info",
		authLevel:1,
		status:200,
		action:this.api.store.info,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"put",
		path:"store/{string}/{number}",
		authLevel:1,
		status:200,
		action:this.api.store.update,
		authAction:this.auth.checkRoles,
		baas:this
	});

	this.router.addRoute({
		method:"query",
		path:"store/{string}",
		authLevel:1,
		status:200,
		action:this.api.store.query,
		authAction:this.auth.checkRoles,
		baas:this
	});
	
	this.router.addRoute({
		method:"delete",
		path:"store/{string}/{number}",
		authLevel:1,
		status:200,
		action:this.api.store.del,
		authAction:this.auth.checkRoles,
		baas:this
	});
	
	this.router.addRoute({
		method:"post",
		path:"store",
		authLevel:1,
		status:201,
		action:this.api.store.createObject,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"put",
		path:"store",
		authLevel:1,
		status:200,
		action:this.api.store.updateObject,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"get",
		path:"store",
		authLevel:1,
		status:200,
		action:this.api.store.getObjects,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	/*this.router.addRoute({
		method:"delete",
		path:"store",
		authLevel:1,
		status:200,
		action:this.api.store.deleteObject,
		authAction:this.auth.isAdmin,
		baas:this
	});*/
	
	
	this.router.addRoute({
		method:"post",
		path:"user/login",
		authLevel:0,
		status:200,
		action:this.api.users.login,
		baas:this
	});
	
		
	this.router.addRoute({
		method:"get",
		path:"user/logout",
		authLevel:1,
		status:200,
		action:this.api.users.logout,
		baas:this
	});
	
	this.router.addRoute({
		method:"post",
		path:"user",
		authLevel:0,
		status:201,
		action:this.api.users.create,
		baas:this
	});
	
	this.router.addRoute({
		method:"get",
		path:"user/{number}",
		authLevel:1,
		status:200,
		action:this.api.users.retrieve,
		baas:this
	});
	
	this.router.addRoute({
		method:"query",
		path:"user",
		authLevel:1,
		status:200,
		action:this.api.users.query,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"put",
		path:"user/{number}",
		authLevel:1,
		status:200,
		action:this.api.users.update,
		baas:this
	});
	
	this.router.addRoute({
		method:"get",
		path:"user/activate",
		authLevel:0,
		status:200,
		action:this.api.users.activateUser,
		baas:this
	});	
	
	this.router.addRoute({
		method:"get",
		path:"user/forgotpassword",
		authLevel:0,
		status:200,
		action:this.api.users.forgotPassword,
		baas:this
	});	
	
	this.router.addRoute({
		method:"delete",
		path:"user/{number}",
		authLevel:1,
		status:200,
		action:this.api.users.del,
		authAction:this.auth.checkRoles,
		baas:this
	});
	
	this.router.addRoute({
		method:"post",
		path:"group",
		authLevel:1,
		status:201,
		action:this.api.groups.create,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"query",
		path:"group",
		authLevel:1,
		status:200,
		action:this.api.groups.query,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"put",
		path:"group/{number}",
		authLevel:1,
		status:200,
		action:this.api.groups.update,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"delete",
		path:"group/{number}",
		authLevel:1,
		status:200,
		action:this.api.groups.del,
		authAction:this.auth.isAdmin,
		baas:this
	});
	
	this.router.addRoute({
		method:"post",
		path:"setup",
		authLevel:0,
		status:200,
		action:this.api.setup.setup,
		baas:this
	});
	
	this.router.addRoute({
		method:"get",
		path:"view",
		authLevel:0,
		status:200,
		action:this.api.view,
		baas:this
	});
	
		this.router.addRoute({
		method:"get",
		path:"message",
		authLevel:0,
		status:200,
		action:function(handler) {
			handler.respond(decodeURIComponent(handler.queryString));
		},
		baas:this
	});
}


Baas.prototype.connect = function(cname, callback,  write) {
	if(!write)write = 0;
	var baas = this;
	Db.connect(format("mongodb://%s:%s/"+baas.name+"?w=%s", baas._dhost, baas._dport, write), function(err, db){
		db.collection(baas.name+cname, function(err, collection) {
			if(collection) {
				callback(db, collection);
			}
		});
	});
}

Baas.prototype.dbError = function(handler, db) {
	db.close();
	handler.response.writeHead(500, []);
	handler.response.end("");
	return false;
}

Baas.prototype.setMongoDB = function(host, port) {
	this._dhost = host;
	this._dport = port;
}

Baas.prototype.configureSMTP = function(username, password) {
	this._smtpTransport = nodemailer.createTransport("SMTP",{
		auth: {
			user:username,
			pass:new Buffer(password, 'base64').toString('ascii')
		}
	});
}

Baas.prototype.setTemplateForgotPassword = function(from, subject, htmlBody, textBody) {
	this._templateForgotPassword = {from:from, subject:subject, htmlBody:htmlBody, textBody:textBody};
}

Baas.prototype.setTemplateActivate = function(from, subject, htmlBody, textBody, complete, notFound) {
	this._templateActivate = {from:from, subject:subject, htmlBody:htmlBody, textBody:textBody, complete:complete, notFound:notFound};
}

Baas.generateString = function(min, max, args) {
	var alpha = "abcdefghijklmnopqrstuvwxyz";
	var upperAlpha = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; 
	var num = "01234567890";
	
	if(args==null) {
		var chars = alpha+num;
	}else{
		var args = Array.prototype.splice.call(arguments,2);
		for(var i=0;i<args.length;i++) {
			switch(args[i]) {
				case 0:
					chars+=alpha;
					break;
				case 1:
					chars+=upperAlpha;
					break;
				case 2:
					chars+=num;
					break;
			}
		}
	}

	var l = Math.floor(Math.random()*(max - min + 1))+min;
	var str = "";
	while(str.length<l) {
		str += chars.charAt(Math.floor(Math.random()*chars.length));
	}
	return str;
}

Baas.parseCookies = function(handler) {
	var cookies = {};
	handler.request.headers.cookie && handler.request.headers.cookie.split(';').forEach(function( cookie ) {
		var parts = cookie.split('=');
		cookies[ parts[ 0 ].trim() ] = ( parts[ 1 ] || '' ).trim();
	});
	
	return cookies;
}

Baas.replaceMarkers = function(str, objs) {
	var stubs = str.match(/#{(.*?)}/g);
	for(var i=0;i<stubs.length;i++) {
		var val = stubs[i];
		var s = stubs[i].replace("#{","").replace("}","");
		s = s.split(".");
		var testObj = objs;
		
		for(var j=0;j<s.length;j++) {
			if(testObj[s[j]]){
				testObj = testObj[s[j]];
			}else{
				var testObj = "";
				break;
			}
		}
	
		testObj = testObj.toString();
		return str.replace(val,testObj);
	}
}

Baas.prototype._sendMessage = function(to, template, templateObjs) {

	var htmlBody = Baas.replaceMarkers(template.htmlBody, templateObjs);
	var textBody = Baas.replaceMarkers(template.textBody, templateObjs);
	
	var options = {};
	options.to = to;
	options.from = template.from || this._smtpTransport.options.auth;
	options.subject = template.subject;
	options.html = htmlBody;
	options.text = textBody;
	
	this._smtpTransport.sendMail(options, function(error, response) {
		
	});
}

Baas.prototype.api = {
	defaultSchemaValues:["objectId","createdOn","updatedOn"],
	reservedStoreNames:["users_","groups_","list"],
	isReserved:function(name) {
		for(var i=0;i<this.reservedStoreNames.length;i++) {
			if(this.reservedStoreNames[i]==name){
				return true;
			}
		}
		return false;
	},
	
	store:{
		createObject:function(handler, callback) {
			var badRequest = false;
			
			try {
				var data =  JSON.parse(handler.data);
			}catch(err){
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			if(typeof data.name != "string")badRequest = true;
			if(typeof data.schema != "object")badRequest = true;
			if(typeof data.roles != "object")badRequest = true;
			if(data.name == "list_")badRequest = true;
			
			if(badRequest) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			var baas = handler.route.baas;
			baas.connect(".store."+data.name, function(db, collection) {
			
				collection.find({},{_schema:1,_id:0}).limit(1).toArray(function(err, docs) {
					if(err)return baas.dbError(handler, db);
					if(docs[0]!=undefined) {
						handler.respondWithDefault("Conflict", callback);
						db.close();
					}else{
						data.schema._key = 0;
						collection.insert({_schema:data.schema}, {w:0});
						collection.insert({_roles:data.roles}, {w:0});
						
						baas.connect(".store.list_", function(db1, collection1) {
							collection1.insert({name:data.name}, {w:0});
						
							db1.close();
							handler.respond("", callback);
						});
					}
					
				});
			},1);
		},
		
		updateObject:function(handler, callback) {
			try {
				var data =  JSON.parse(handler.data);
			}catch(err){
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			var badRequest = false;
			if(typeof data.name != "string")badRequest = true;
			
			if(badRequest) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			handler.route.baas.connect(".store."+data.name, function(db, collection) {
				collection.find({_schema : {$ne:null}},{_schema:1,_id:0}).limit(1).toArray(function(err, docs0){
					if(err)return handler.route.baas.dbError(handler, db);
					
					collection.find({objectId : {$ne:null}},{_id:0}).limit(1).toArray(function(err, docs1){
						if(err)return handler.route.baas.dbError(handler, db);
						
						collection.find({_roles : {$ne:null}},{_id:0}).limit(1).toArray(function(err, docs2){
							if(err)return handler.route.baas.dbError(handler, db);
							
							if(docs0.length == 0) {
								handler.respondWithDefault("Bad Request", callback);
							} else {
								if(data.schema) {
									for(var value in data.schema) {
										if(value=="_key"){
											continue;
										}
										if(data.schema[value]==null){
											delete docs0[0]._schema[value];
										}else{
											docs0[0]._schema[value] = data.schema[value];
										}
									}
									var schema = docs0[0];
									collection.update({_schema : {$ne:null} }, {$set: schema}, {w:0});
								}
								
								if(data.roles) {
									for(var value in data.roles) {
										if(docs2[0]._roles[value]) {
											for(var value2 in data.roles[value]) {
												if(docs2[0]._roles[value][value2]){
													for(var i=0;i<data.roles[value][value2].length;i++){
														if(typeof data.roles[value][value2][i] == "string") {
															if(data.roles[value][value2][i].substr(0,1)=="-") {
																docs2[0]._roles[value][value2].splice( docs2[0]._roles[value][value2].indexOf( data.roles[value][value2][i].slice(1) ),1)
															}else if( docs2[0]._roles[value][value2].indexOf( data.roles[value][value2][i] )==-1 ){
																docs2[0]._roles[value][value2].push( data.roles[value][value2][i] );
															}
														}else if(data.roles[value][value2][i]<0){
															if( docs2[0]._roles[value][value2].indexOf( Math.abs(data.roles[value][value2][i]) )>-1 ){
																docs2[0]._roles[value][value2].splice( docs2[0]._roles[value][value2].indexOf( Math.abs(data.roles[value][value2][i]) ),1);
															}
														}else{
															if( docs2[0]._roles[value][value2].indexOf( data.roles[value][value2][i] )==-1 ){
																docs2[0]._roles[value][value2].push( data.roles[value][value2][i] );
															}
														}
													}
												}else{
													docs2[0]._roles[value][value2]=data.roles[value][value2];
												}
											}
										}else{
											docs2[0]._roles[value] = data.roles[value];
										}
									}
									var roles = docs2[0];
									collection.update({_roles : {$ne:null} }, {$set: roles}, {w:0});
									
								}
					
								handler.respond("", callback);
								
							}
							db.close();
						});
					});
				});
			});
		},
		
		//to-do
		deleteObject:function(handler, callback) {
			
		},
		
		getObjects:function(handler, callback) {
			handler.route.baas.connect(".store.list_", function(db, collection) {
				collection.find({name : {$ne:null} },{_id:0}).limit(0).toArray(function(err, docs){
					if(err)return handler.route.baas.dbError(handler, db);
					var list = [];
					for(var i=0;i<docs.length;i++){
						if(docs[i].name!="users_" && docs[i].name!="groups_") {
							list.push(docs[i].name);
						}
					}
				
					handler.respond(list, callback);
					
					db.close();	
				});
			});
		},
		
		create:function(handler, callback) {
			try {
				var data = JSON.parse(handler.data);
			}catch(err){
				handler.respondWithDefault("Bad Request", callback);
				return;
			}		
		
			if( handler.route.baas.api.isReserved(handler.path[1]) && !callback ) {
				var forbidden = true;
				if(handler.user) {
					if(handler.user.admin) {
						forbidden = false;
					}
				}
				if(forbidden) {
					handler.status = 403;
					handler.respond("", callback);
					return;
				}
			}
			
			handler.route.baas.connect(".store."+handler.path[1], function(db, collection) {
				collection.find({_schema : {$ne:null} },{_schema:1,_id:0}).limit(1).toArray(function(err, docs){
					if(err)return handler.route.baas.dbError(handler, db);
					if(docs.length==0){
						handler.respondWithDefault("Not Found", callback);
					}else{
						var schema = docs[0]._schema;
						var count = 0;
						for(var value in data){
							count++;
						
							if(schema[value]==undefined){
								count--;
								delete data[value];
								continue;
							}
							
							if(schema[value]=="array")schema[value]="object";
							if(typeof data[value] != schema[value]) {
								db.close();
								
								handler.respondWithDefault("Bad Request", callback);
								return;
							}
						}
						
						if(count == 0) {
							handler.respondWithDefault("Bad Request", callback);
							
						}else{
							if(data._schema)delete data._schema;
							schema._key+=1;
							collection.update({_schema : {$ne:null} }, {$inc: {"_schema._key":1}}, {w:0});
							data.createdOn = new Date();
							data.updatedOn = data.createdOn;
							
							data.objectId = schema._key;
							collection.insert(data, {w:0});
							
						
							handler.respond("", callback);
						
						}
					}
					db.close();
				});
			},1);
		},
		
		retrieve:function(handler, callback) {
			if( handler.route.baas.api.isReserved(handler.path[1]) && !callback ) {
				var forbidden = true;
				if(handler.user) {
					if(handler.user.admin) {
						forbidden = false;
					}
				}
				if(forbidden) {
					handler.status = 403;
					handler.respond("", callback);
					return;
				}
			}
		
			handler.route.baas.connect(".store."+handler.path[1], function(db, collection) {
				collection.find({_schema : {$ne:null} },{_schema:1,_id:0}).limit(1).toArray(function(err, doc) {
					if(err)return handler.route.baas.dbError(handler, db);
					
					collection.find({objectId:parseInt(handler.path[2])}, {_id:0}).limit(1).toArray(function(err, docs) {
						if(err)return handler.route.baas.dbError(handler, db);
						
						if(docs.length==0) {
							handler.status = 404;
						
							handler.respond({}, callback);
							
						}else{
							for(var i=0;i<handler.route.baas.api.defaultSchemaValues.length;i++) {
								doc[0]._schema[handler.route.baas.api.defaultSchemaValues[i]] = "";
							}
							for(var value in docs[0]) {
								if(doc[0]._schema[value]==undefined) {
									delete docs[0][value];
								}
							}
							if(typeof callback == "function") {
								callback(handler,docs[0]);
							}else{
								if(handler.path[1]=="users_" ||handler.path[1]=="groups_"){
									handler.respond("");
								}else{
									handler.respond(docs[0]);
								}
							}
						}
						db.close();
					});
				});
			});
		},
		
		update:function(handler, callback) {
			try {
				var data = JSON.parse(handler.data);
			}catch(err){
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			if( handler.route.baas.api.isReserved(handler.path[1]) && !callback ) {
				var forbidden = true;
				if(handler.user) {
					if(handler.user.admin) {
						forbidden = false;
					}
				}
				if(forbidden) {
					handler.status = 403;
					handler.respond("", callback);
					return;
				}
			}
			
			handler.route.baas.connect(".store."+handler.path[1], function(db, collection) {
				collection.find({$or:[{_schema:{$ne:null}}, {objectId:parseInt(handler.path[2])}] },{_id:0}).sort({_schema:-1}).limit(2).toArray(function(err, docs){
					if(err)return handler.route.baas.dbError(handler, db);
					
					if(docs.length<2){
						handler.respondWithDefault("Not Found", callback);
					}else{
						var schema = docs[0]._schema;
						var count = 0;
						for(var value in data){
							count++;
						
							if(schema[value]==undefined){
								count--;
								delete data[value];
								continue;
							}
							
							if(schema[value]=="array")schema[value]="object";
							if(data[value]==null) {
								//
							}else if(typeof data[value] != schema[value]) {
								db.close();
								handler.respondWithDefault("Bad Request", callback);
								return;
							}
						}
						
						if(count == 0) {
							handler.respondWithDefault("Bad Request", callback);
						}else{
							if(data._schema)delete data._schema;
							data.updatedOn = new Date();
							collection.update({objectId:parseInt(handler.path[2])}, {$set:data}, {w:0})
							
							handler.respond("", callback);
							
						}
					}
					
					db.close();
				});
			},1);
		},
		
		query:function(handler, callback) {
			if( handler.route.baas.api.isReserved(handler.path[1]) && !callback ) {
				var forbidden = true;
				if(handler.user) {
					if(handler.user.admin) {
						forbidden = false;
					}
				}
				if(forbidden) {
					handler.status = 403;
					handler.respond("", callback);
					return;
				}
			}
			
			if(!handler.queryString) {
				handler.queryString="%7B%7D";
			}
			try {
				var data = JSON.parse(decodeURIComponent(handler.queryString));
				var where = data.where || {};
				var limit = data.limit || 0;
				var skip = data.skip || 0;
				var sort = data.sort || {};
				var count = data.count || false;
				var select = data.select || {};
			}catch(err){
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			if(skip<0) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			if(typeof where != "object" || typeof sort != "object" || typeof select != "object") {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			handler.route.baas.connect(".store."+handler.path[1], function(db, collection) {
				if(count) {
					collection.find({$and:[{objectId:{$ne:null}},where]}, {objectId:1,_id:0}).count(function(err, c){
						if(err)return handler.route.baas.dbError(handler, db);
						
						handler.respond(c.toString(), callback);
						db.close();
					});
				}else{
						//console.log( collection.find({}).toArray==Db.connect.Cursor.prototype.toArray );
						//return;
					collection.find({_schema : {$ne:null} },{_schema:1,_id:0}).limit(1).toArray(function(err, doc) {
						select._id = 0;
						if(err)return handler.route.baas.dbError(handler, db);
					
						collection.find({$and:[{objectId:{$ne:null}},where]}, select).limit(limit).sort(sort).skip(skip).toArray(function(err, docs){
							if(err)return handler.route.baas.dbError(handler, db);
							
							if(docs.length==0) {
								handler.respond([], callback);
							}else{
								for(var i=0;i<handler.route.baas.api.defaultSchemaValues.length;i++) {
									doc[0]._schema[handler.route.baas.api.defaultSchemaValues[i]] = "";
								}
								
								for(var i=0;i<docs.length;i++) {
									for(var value in docs[i]) {
										if(doc[0]._schema[value]==undefined) {
											delete docs[i][value];
										}
									}
								}
								
								if(typeof callback == "function") {
									callback(handler,docs);
								}else{
									if(handler.path[1]=="users_" ||handler.path[1]=="groups_"){
										handler.respond("");
									}else{
										handler.respond(docs, callback);
									}
								}
							}
							db.close();
						});
					});
				}
				
			});
		},
		
		del:function(handler, callback) {
			if( handler.route.baas.api.isReserved(handler.path[1]) && !callback ) {
				var forbidden = true;
				if(handler.user) {
					if(handler.user.admin) {
						forbidden = false;
					}
				}
				if(forbidden) {
					handler.status = 403;
					handler.respond("", callback);
					return;
				}
			}
		
			handler.route.baas.connect(".store."+handler.path[1], function(db, collection) {
				collection.find({objectId:parseInt(handler.path[2])}, {_id:0}).limit(1).toArray(function(err, docs){
					if(err)return handler.route.baas.dbError(handler, db);
					
					if(docs.length==0){
						handler.respondWithDefault("Not Found", callback);
					}else{
						collection.remove({objectId:parseInt(handler.path[2])}, true, function(err, result) {
							if(err)return handler.route.baas.dbError(handler, db);
							
							handler.respond("", callback);
						});
					}
					db.close();
				});
			});
		},
		
		info:function(handler, callback) {
		/*	if( handler.route.baas.api.isReserved(handler.path[1]) && !callback ) {
				var forbidden = true;
				if(handler.user) {
					if(handler.user.admin) {
						forbidden = false;
					}
				}
				if(forbidden) {
					handler.status = 403;
					handler.respond("", callback);
					return;
				}
			}*/
		
			handler.route.baas.connect(".store."+handler.path[1], function(db, collection) {
				collection.find({$or:[{_schema:{$ne:null}},{_roles:{$ne:null}}]}, {_id:0}).limit(2).toArray(function(err, docs){
					if(err)return handler.route.baas.dbError(handler, db);
				
					if(docs.length==0){
						handler.respondWithDefault("Not Found", callback);
					}else{
						var info = {};
						
						for(var i=0;i<docs.length;i++) {
							if(docs[i]._schema) {
								info.schema = docs[i]._schema;
							}
							if(docs[i]._roles) {
								info.roles= docs[i]._roles;
							}
						}
						
						handler.respond(info, callback);
					}
					db.close();
				});
			});
		}
		
	},
	
	users:{
		create:function(handler, callback) {
			
			try {
				var data = JSON.parse(handler.data);
				var username = data.username;
				var password = data.password;
			} catch(err) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			if(!username || !password) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
		
			handler.route.baas.auth.getUser(handler,function(h) {
			
				if(h.user) {
					if(!h.user.admin && data.admin) {
						data.admin = false;
					}
				}else{
					data.admin = false;
				}
				
				if(handler.route.baas.allowUserActivation) {
					data.active = false;
					data.activateCode = SHA1(Math.random().toString()+Baas.generateString(4,24,0,1,2));
					
					if(!data.email) {
						handler.status = 409;
						handler.respond({message:"Email address is required"}, callback);
						return;
					}
				}
				
				data.salt = Baas.generateString(8,20,0,1,2);
				data.password = SHA1(data.salt+data.password);
				
				handler.data = JSON.stringify(data);
				handler.path = ["","users_"];
				
				handler.queryString =  encodeURIComponent( JSON.stringify({where:{$or:[{username:data.username},{email:data.email}]}}) );
				handler.route.baas.api.store.query(handler, function(handler,r) {
					
					if(r.length>0){
						handler.status = 409;
						var usercheck=0;
						var emailcheck=0;
						
						for(var i=0;i<r.length;i++) {
							if(r[i].username == data.username)usercheck = 1;
							if(r[i].email == data.email)emailcheck = 2;
						}
						
						switch(usercheck + emailcheck) {
							case 1:
								handler.respond({message:"Username is taken"}, callback);
								break;
							case 2:
								handler.respond({message:"Email is in use"}, callback);
								break;
							case 3:
								handler.respond({message:"Username and email are in use"}, callback);
								break;
						}
					}else{
						
						handler.route.baas.api.store.create(handler, function(handler,r) {
							if(handler.route.baas.allowUserActivation) {
							
								handler.data = JSON.parse(handler.data);
								handler.route.baas._sendMessage(data.email,handler.route.baas._templateActivate,{url:handler.route.baas.externalUrl,handler:handler});
							}
						
							handler.respond("", callback);
						});
					}
				});
			});
		},
		
		login:function(handler, callback) {
			
			if(handler.headers["authorization"]) {
				try {
					var auth = new Buffer(handler.headers["authorization"].split("Basic ")[1], 'base64').toString('ascii').split(":");
					var data = {user:auth[0],password:auth[1]};
				}catch(err){
					handler.respondWithDefault("Bad Request");
					return;	
				}
			}else{
				try {
					var data =  JSON.parse(decodeURIComponent(handler.data));
				}catch(err){
					handler.respondWithDefault("Bad Request", callback);
					return;
				}
			}
			
			if((!data.user) || !data.password) {
				handler.respondWithDefault("Unauthorized", callback);
				return;
			}
			
			var condition;
			switch(handler.route.baas.loginAllowedType) {
				case Baas.ALLOW_USERNAME_EMAIL:
					condition = {$or:[{username:data.user}, {email:data.user}]};
					break;
				case Baas.ALLOW_EMAIL:
					condition = {email:data.user};
					break;
				case Baas.ALLOW_USERNAME:
					condition = {username:data.user};
					break;
			}
			
			handler.queryString = encodeURIComponent( JSON.stringify({where:condition}) );
			
			handler.path[1] = "users_";
			handler.route.baas.api.store.query(handler, function(handler,r) {
				if(r.length == 0) {
					handler.respondWithDefault("Unauthorized", callback);
					return;
				}else{
					r = r[0];
				
					if(r.oneTimePassword!=null) {
						if(r.oneTimePassword!=data.password && r.password!=SHA1(r.salt+data.password)) {
							handler.respondWithDefault("Unauthorized", callback);
							return;
						}else if(r.oneTimePassword==data.password) {
							handler.path[2] = r.objectId;
							handler.data = JSON.stringify({oneTimePassword:null});
							handler.route.baas.api.store.update(handler,function(handler, r3) {});
						}
					}else if(r.password!=SHA1(r.salt+data.password)) {
						handler.respondWithDefault("Unauthorized", callback);
						return;
					}
					
					if(!r.active){
						handler.status = 403;
						handler.respond({message:"User not activated"}, callback);
						return;
					}
					
					var cookies = Baas.parseCookies(handler);
				
					var session = cookies.s || handler.request.headers["Session-Id"];
					
					if(!session) session = null;
					handler.path[1] = "sessions_";
					handler.queryString =  encodeURIComponent( JSON.stringify({where:{$and:[{session:session},{userId:r.objectId}]}}) );
					handler.route.baas.api.store.query(handler, function(err, r2) {
						if(r2.length==0) {
							if(session) {
								handler.user = {session:session};
								handler.route.baas.api.users.logout(handler, function(handler, r4) {});
							}
							var sessionSecret = Baas.generateString(24,64,0,1,2);
							var loggedOn = new Date().toString();
							var sha = SHA1(r.username+""+r.objectId+""+sessionSecret);
							
							handler.data = JSON.stringify({session:sha,sessionSecret:sessionSecret,userId:r.objectId,agent:handler.request.headers["user-agent"],ip:handler.request.connection.remoteAddress});
							handler.route.baas.api.store.create(handler,function(handler, r3) {
								handler.addHeader("Set-Cookie", "s="+sha+"; Path=/ ");
								handler.respond({username:r.username,session:sha,id:r.objectId}, callback);
							});
						}else{
							handler.respond({username:r.username,session:session,id:r.objectId}, callback);
						}
					});
				}
			});
		},
		
		logout:function(handler, callback) {
			handler.path = [null,"sessions_"];
			handler.queryString = JSON.stringify({where:{session:handler.user.session}});
			handler.route.baas.api.store.query(handler, function(handler,r) {
				if(!r[0]) {
					handler.respondWithDefault("Bad Request", callback);
					return;
				}
				r = r[0];
				handler.path = ["","sessions_",r.objectId];
				handler.route.baas.api.store.del(handler, function(handler,r) {
				
					handler.addHeader("Set-Cookie", "s=; Path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT");
					handler.respond({message:"logged out"}, callback);
				});
			});
		},
		
		retrieve:function(handler, callback) {
			if(handler.user.admin || handler.user.id==handler.path[1]){
				handler.path = ["","users_",handler.path[1]];
				handler.route.baas.api.store.retrieve(handler,function(handler, r) {
					delete r.password;
					delete r.admin;
					handler.respond(r, callback);
				});
			}else{
				handler.respondWithDefault("Unauthorized", callback);
			}
		},
		
		update:function(handler, callback) {
			try {
				var data = JSON.parse(handler.data);
			} catch(err) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			if(data.session || data.sessionSecret) {
				handler.respondWithDefault("Conflict", callback);
				return;
			}
			
			if(handler.user.admin && handler.user.id==handler.path[1] && (data.admin===false || data.active===false)) {
				handler.respondWithDefault("Conflict", callback);
				return;
			}
			
			if(data.password) {
				data.salt = Baas.generateString(8,20,0,1,2);
				data.password = SHA1(data.salt+data.password);
			}
			
			if(handler.user.admin || handler.user.id==handler.path[1]){
				handler.data = JSON.stringify(data);
				handler.path = ["","users_",handler.path[1]];
				handler.route.baas.api.store.update(handler,function(handler, r) {
					handler.respond(r, callback);
				});
			}else{
				handler.respondWithDefault("Unauthorized", callback);
			}
		},
		
		del:function(handler, callback) {
	
			if(handler.user.id==handler.path[1]) {
				handler.respondWithDefault("Conflict", callback);
				return;
			}
		
			handler.path = ["","users_",handler.path[1]];

			handler.route.baas.api.store.del(handler,function(handler, r) {
				handler.respond(r, callback);
			});
		},
		
		query:function(handler, callback) {
			handler.path = ["","users_"];
			handler.route.baas.api.store.query(handler,function(handler, r) {
				for(var i=0;i<r.length;i++) {
					r[i].password = "hidden";
					delete r[i].sessionSecret;
					delete r[i].session;
					
				}
				handler.respond(r, callback);
			});
		},
		
		activateUser:function(handler, callback) {
			if(!handler.queryString){
				handler.respondWithDefault("Unauthorized", callback);
				return;
			}
			handler.path = ["","users_"];
			handler.queryString = JSON.stringify({where:{activateCode:handler.queryString}});
			handler.route.baas.api.store.query(handler,function(handler, r) {
				handler.status = 301;
				handler.addHeader("Content-Type","text/html");
				handler.addHeader("Location", handler.route.baas._templateActivate.notFound);
				
				if(r.length==0) {
					handler.respond("Not Found", callback);
					return;
				}
				
				handler.path = ["","users_",r[0].objectId];
				handler.data = JSON.stringify({active:true,activateCode:null});
				handler.route.baas.api.store.update(handler,function(handler, r2) {
					handler.addHeader("Location", handler.route.baas._templateActivate.complete);
					handler.respond("Moved Permanently", callback);
				});
			});
		},
		
		forgotPassword:function(handler, callback) {
			try {
				var data =  JSON.parse(decodeURIComponent(handler.queryString));
			} catch(err) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}

		
			if(!data.email) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			data.oneTimePassword =  Baas.generateString(5,8,0,2);
		
			handler.path = ["","users_"];
			handler.queryString =  encodeURIComponent( JSON.stringify({where:{email:data.email},select:{objectId:1}}) );
			handler.route.baas.api.store.query(handler,function(handler, r) {
				handler.path = ["","users_",r[0].objectId];
				handler.data = JSON.stringify({oneTimePassword:data.oneTimePassword});
				handler.route.baas.api.store.update(handler, function(handler, r) {
					handler.respond(r, callback);
					handler.route.baas._sendMessage(data.email,handler.route.baas._templateForgotPassword,{password:data.oneTimePassword,url:handler.route.baas.externalUrl,handler:handler});
				});
			});		
		}
	},
	
	groups:{
		create:function(handler, callback){
			try{
				var data = JSON.parse(handler.data);
				var users = data.users;
			}catch(err){
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
			
			if(!users) {
				handler.respondWithDefault("Bad Request", callback);
				return;
			}
		
			handler.path = ["","groups_"];
			handler.route.baas.api.store.create(handler, function(handler,r) {
					handler.respond("", callback);
			});
		},
		
		update:function(handler, callback) {
			handler.path = ["","groups_",handler.path[1]];
			handler.route.baas.api.store.update(handler,function(handler, r) {
				handler.respond(r, callback);
			});
		},
		
		query:function(handler, callback) {
			handler.path = ["","groups_"];
			handler.route.baas.api.store.query(handler,function(handler, r) {
				handler.respond(r, callback);
			});
		},
		
		del:function(handler, callback) {
			handler.path = ["","groups_",handler.path[1]];
			handler.route.baas.api.store.del(handler,function(handler, r) {
				handler.respond(r, callback);
			});
		}
	},
	
	setup:{
		setup:function(handler) {
			try {
				var data = JSON.parse(handler.data);
				var username = data.username;
				var password = data.password;
			}catch(err){
				handler.respondWithDefault("Bad Request");
				return;
			}
			
			if(!username || !password) {
				handler.respondWithDefault("Bad Request");
				return;
			}
			
			handler.data = '{"name":"groups_","schema":{"name":"string","users":"array"},"roles":{}}';
			handler.route.baas.api.store.createObject(handler, function(handler,r) {
				handler.status = 200;
			});
			
		
			handler.data = '{"name":"sessions_","schema":{"userId":"number","session":"string","sessionSecret":"string","agent":"string","ip":"string"},"roles":{}}';
			handler.route.baas.api.store.createObject(handler, function(handler,r) {
				handler.status = 200;
			});
			
			handler.data = '{"name":"users_","schema":{"username":"string","password":"string","email":"string","activateCode":"string","active":"boolean","admin":"boolean","loggedOn":"string","oneTimePassword":"string","salt":"string"},"roles":{}}';
			handler.route.baas.api.store.createObject(handler, function(handler,r) {
				if(handler.status == 409) {
					handler.status = 501;
					handler.respond("");
					return;
				}
				
				handler.path.push("users_");
				
				data.admin = true;
				data.active = true;
				data.salt = Baas.generateString(8,20,0,1,2);
				data.password = SHA1(data.salt+data.password);
				handler.data = JSON.stringify(data);
				
				handler.route.baas.api.store.create(handler, function(handler,r) {
					handler.respond("");
				});
			});
		}
	},
	viewContents:null,
	view:function(handler) {
		if(handler.route.baas.api.viewContents) {
			handler.addHeader("Content-Type","text/html");
			handler.respond("<span style='font-size:11px;font-weight:bold'>Sandbox Store: "+handler.route.baas.name+"</span><br><br>"+handler.route.baas.api.viewContents);
		}else{
			var options = {
			  host: 'jjbateman.github.io',
			  path: '/BaaS/view.html'
			};

			callback = function(response) {
			  var str = '';
			  response.on('data', function (chunk) {
				str += chunk;
			  });
			  response.on('end', function () {
				handler.route.baas.api.viewContents = str;
				handler.route.baas.api.view(handler);
			  });
			}
			http.request(options, callback).end();
		}
	}
}

Baas.prototype.auth = {
	getUser:function(passthrough, callback) {
		
		var cookies = Baas.parseCookies(passthrough);
		var session = cookies.s || passthrough.request.headers["session-id"];
		if(!session){
			if(typeof callback=="function") { 
				callback(passthrough);
			}else{
				passthrough.check(0);
			}
			return;
		}
		
		var path = passthrough.path.slice(0);
		var queryString = passthrough.queryString;
		
		passthrough.path = ["","sessions_"];
		passthrough.queryString = encodeURIComponent(JSON.stringify({where:{session:session}}));
		passthrough.route.baas.api.store.query(passthrough, function(passthrough,r) {
			if(r.length==0) {
				passthrough.check(0);
				return;
			}
			r = r[0]
			
			if(r.agent!=passthrough.headers["user-agent"]) {
				passthrough.check(0);
				return;
			}
			
			passthrough.queryString = encodeURIComponent(JSON.stringify({where:{objectId:r.userId}}));
			passthrough.path = ["","users_"];
			passthrough.route.baas.api.store.query(passthrough, function(passthrough,r2) {
			
				if(r2.length==0){
					if(typeof callback=="function") {
						callback(passthrough);
					}else{
						passthrough.check(0);
					}
					return;
				}

				r2 = r2[0];
				passthrough.path = path;
				passthrough.queryString = queryString;
				passthrough.user = {username:r2.username,id:r2.objectId,session:r.session,admin:r2.admin};
			
				if(r.active===false) {
					if(typeof callback=="function") { 
						callback(passthrough);
					}else{
						passthrough.status = 401;
						passthrough.respond({message:"User not activated"});
					}
					return;
				}
				if(session!=SHA1(r2.username+""+r2.objectId+""+r.sessionSecret)) {
					passthrough.check(0);
					return;
				}
				
				if(typeof callback=="function") { 
					callback(passthrough);
				}else{
					passthrough.check(1);
				}
			});
			
		});
		
		
	},
	
	isAdmin:function(passthrough) {
		passthrough.route.baas.auth.getUser(passthrough,function(passthrough) {
			if(!passthrough.user) {
				passthrough.check(0);
				return;
			}
		
			if(passthrough.user.admin) {
				passthrough.check(1);
			}else{
				passthrough.check(0);
			}
		});
	},
	
	checkRoles:function(passthrough) {
		passthrough.route.baas.auth.getUser(passthrough,function(passthrough) {
			
			if(!passthrough.user) {
				passthrough.user = {admin:null,id:null};
			}
			
			if(passthrough.user.admin) {
				passthrough.check(1);
			}else{
				passthrough.route.baas.connect(".store."+passthrough.path[1], function(db, collection) {
					collection.find({_roles: {$ne:null}},{_roles:1,_id:0}).limit(1).toArray(function(err, docs) {
						if(docs.length==0) {
							passthrough.check(0);
							return;
						}
						
						docs = docs[0]._roles;
						if(docs[passthrough.route.method]) {
							if(docs[passthrough.route.method].user) {
							
								if(docs[passthrough.route.method].user.indexOf("*")>-1) {
									passthrough.check(1);
								}
								else if(docs[passthrough.route.method].user.indexOf(".")>-1 && passthrough.user.id) {
									passthrough.check(1);
								}
								else if(docs[passthrough.route.method].user.indexOf(passthrough.user.id)>-1) {
									passthrough.check(1);
								}else if(docs[passthrough.route.method].group){
									passthrough.route.baas.auth.checkForGroup(docs[passthrough.route.method].group,passthrough);
								}else{
									passthrough.check(0);
								}
							}else if(docs[passthrough.route.method].group){
								passthrough.route.baas.auth.checkForGroup(docs[passthrough.route.method].group,passthrough);
							}else{
								passthrough.check(0);
							}
						}else{
							passthrough.check(0);
						}
						db.close();
					});
				});
			}
		});
	},
	
	checkForGroup:function(groups, passthrough, callback) {
		var path = passthrough.path.slice(0);
		var queryString = passthrough.queryString;
		
		passthrough.queryString = encodeURIComponent(JSON.stringify({where:{objectId:{$in:groups}},limit:0}));
		passthrough.path = ["","groups_"];
	
		passthrough.route.baas.api.store.query(passthrough,function(passthrough,r){
			passthrough.path = path;
			passthrough.queryString = queryString;
			
			for(var i=0;i<r.length;i++){
				if(r[i].users.indexOf(passthrough.user.id)>-1) {
					if(typeof callback == "function") {
						callback(passthrough,1);
					}else{
						passthrough.check(1);
					}
					return;
				}
			}
			if(typeof callback == "function") {
				callback(passthrough,0);
			}else{
				passthrough.check(0);
			}
		});
	}
}

Baas.prototype.addRoute = function(obj) {
	obj.path = "run/"+obj.path;
	obj.baas = this;
	obj._action = obj.action;
	if(obj.roles && !obj.authLevel) {
		if(obj.roles.user) {
			if(obj.roles.user.indexOf("*")>-1) {
				obj.authLevel = 0;
			}else{
				obj.authLevel = 1;
			}
		}else{
			obj.authLevel = 1;
		}
	}
	obj.action = function(handler) {
		handler.store = handler.route.baas.api.store;
		handler.users = handler.route.baas.api.users;
		handler.groups = handler.route.baas.api.groups;
		handler.auth = handler.route.baas.auth;
		
		handler.save = function() {
			this._saved = 
			{
				data:this.data,
				query:(this.query)?this.query.slice(0):null,
				queryString:this.queryString,
				status:this.status,
				path:(this.path)?this.path.slice(0):null 
			}
		}
		handler.restore = function() {
			var saved = this._saved;
			
			this.data = saved.data;
			this.query = saved.query;
			this.queryString = saved.queryString;
			this.status = saved.status;
			this.path = saved.path;
			
			delete saved;
			delete this._saved;
		}
		
		if(obj.roles) {
		
			if(!handler.user) {
				handler.user = {id:null,admin:null};
			}
		
			if(handler.user.admin) {
				obj._action(handler);
				return;
			}
			if(obj.roles.user) {
				if(obj.roles.user.indexOf(handler.user.id)>-1 || obj.roles.user.indexOf(".")>-1 || obj.roles.user.indexOf("*")>-1) {
					obj._action(handler);
					return;
				}
			}
			if(obj.roles.group) {
				handler.route.baas.auth.checkForGroup(obj.roles.group,handler,function(handler,value) {
					if(value==1) {
						obj._action(handler);
					}else{
						handler.respondWithDefault("Unauthorized");
					}
				});
			}else{
				if(allowed) {
					obj._action(handler);
				}else{
					handler.respondWithDefault("Unauthorized");
				}
			}
			
		}else{
			obj._action(handler);
		}
	}
	var r = this.router.addRoute(obj);
	return r;
}

var SHA1 = function(string) {
	var sha = crypto.createHash("sha1");
	sha.update(string);
	return sha.digest("hex");
}


exports.createStore = createStore;