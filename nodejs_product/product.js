var express = require('express');
var app     = express();
var bodyParser = require('body-parser');

app.use(bodyParser.json());

var mysql  = require('mysql');

var dbHost = process.env.MYSQL_HOST,
      dbUser = process.env.MYSQL_USER,
      dbDatabase = process.env.MYSQL_DATABASE,
      dbPassword = process.env.MYSQL_PASSWORD;

if (dbHost == null) dbDatabase = 'product-db';
if (dbDatabase == null) dbDatabase = 'product';

console.log('!!!!!!!!!!!!!!!!!!!!!!dbHost ' + dbHost);
console.log('!!!!!!!!!!!!!!!!!!!!!!dbUser ' + dbUser);
console.log('!!!!!!!!!!!!!!!!!!!!!!!dbDatabase ' + dbDatabase);
console.log('!!!!!!!!!!!!!!!!!!!!!!!dbPassword ' + dbPassword);



//get either featured products or products with keyword
app.get('/product/products', function(req, httpRes) {

	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});
	dbconn.connect(function(err){
	  if(err){
	    console.log('Database connection error');
	  }else{
	    console.log('Database connection successful');
	  }
	});


	if(req.query.featured == null && req.query.keyword == null) {
		httpRes.statusCode = 400;
		return httpRes.send('All products cannot be returned, need to provide a search condition');
	}

	if (req.query.featured != null) {

		dbconn.query('select sku, availability, description, featured=1 as featured, height, image, length, name, price, weight, width from Product where featured=true', function(err, records){
		  if(err) throw err;
		  httpRes.json(records);
		});
	} else if (req.query.keyword != null){
		dbconn.query('select sku, availability, description, featured=1 as featured, height, image, length, name, price, weight, width from Product where SKU in (select SKU from PRODUCT_KEYWORD where Keyword = ?)', req.query.keyword, function(err, records){
		  if(err) throw err;
		  httpRes.json(records);
		});
	} 

	dbconn.end(function(err) {
	    console.log('Database connection is end');
	});
});


//get based on sku #
app.get('/product/products/:sku', function(req, httpRes) {

	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});
	dbconn.connect(function(err){
	  if(err){
	    console.log('Database connection error');
	  }else{
	    console.log('Database connection successful');
	  }
	});

	dbconn.query('select sku, availability, description, featured=1 as featured, height, image, length, name, price, weight, width from Product where SKU = ? ', req.params.sku, function(err, records){
	  if(err) throw err;
	  httpRes.json(records[0]);
	});

	dbconn.end(function(err) {
	    console.log('Database connection is end');
	});

});


//add keyword through post 
app.post('/product/keywords', function(req, httpRes) {

	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});
	dbconn.connect(function(err){
	  if(err){
	    console.log('Database connection error');
	  }else{
	    console.log('Database connection successful');
	  }
	});

	var record= { KEYWORD: req.body.keyword};

	dbconn.query('INSERT INTO Keyword SET ?', record, function(err,dbRes){
	  if(err) throw err;
		var result = {
			keyword : req.body.keyword,
  			products : null}

	  httpRes.json(result);
	});

	dbconn.end(function(err) {
	    console.log('Database connection is end');
	});

});


//add product through post 
app.post('/product/products', function(req, httpRes) {
	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});


	dbconn.connect(function(err){
	  if(err){
	    console.log('Database connection error');
	  }else{
	    console.log('Database connection successful');
	  }
	});


	/* Begin transaction */
	dbconn.beginTransaction(function(err) {
	  	if (err) { throw err; }

		var featured = 0;
		if (req.body.featured = 'true') 
			featured = 1;

		var record= { DESCRIPTION: req.body.description, HEIGHT: req.body.height, LENGTH: req.body.length,  NAME: req.body.name, WEIGHT: req.body.weight, WIDTH: req.body.width, FEATURED: featured, 	AVAILABILITY: req.body.availability, IMAGE: req.body.image, PRICE: req.body.price};

		dbconn.query('INSERT INTO Product SET ?', record, function(err,dbRes){
	    		if (err) { 
	      			dbconn.rollback(function() {
				throw err;
	      			});
	    		}

			var tmpSku = dbRes.insertId;
	 		record = {KEYWORD: req.body.image, SKU: tmpSku};

			dbconn.query('INSERT INTO PRODUCT_KEYWORD SET ?', record, function(err,dbRes){
		      		if (err) { 
					dbconn.rollback(function() {
			  		throw err;
					});
		      		}  
				console.log('record insert into PRODUCT_KEYWORD table');
			      	dbconn.commit(function(err) {
			      		if (err) { 
						dbconn.rollback(function() {
				  		throw err;
						});
		      			}  
				console.log('inserted into both Product and PRODUCT_KEYWORD tables in one transcation ');

				var result = {
					sku : tmpSku,
				  	name : req.body.name,
					description : req.body.description,
					length : req.body.length,
					width : req.body.width, 
					height : req.body.height,
					weight : req.body.weight,
					featured : req.body.featured, 
					availability : req.body.availability,
					price : req.body.price, 
					image : req.body.image
					};

	  			httpRes.json(result);
				dbconn.end(function(err) {
				    console.log('Database connection is end');
				});
		      		}); //end commit
	    		}); //end 2nd query
	  	}); //end 1st query
	});
	/* End transaction */
});

//reduce product through post, this is for the checkout process 
app.post('/product/reduce', function(req, httpRes) {

	var array = req.body.length;


	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});


	var sendReply = false;
	for (var i = 0; i < req.body.length; i++) {
		if(!req.body[i].hasOwnProperty('sku') || !req.body[i].hasOwnProperty('quantity')) {
			httpRes.statusCode = 400;
			return httpRes.send('Error 400: need to have valid sku and quantity.');
		}


		var tmpSku = req.body[i]['sku'];
		var tmpQuantity = req.body[i]['quantity'];
		var sqlStr = 'update Product set availability = availability - ' + tmpQuantity + ' where sku = ' + tmpSku + ' and availability - ' + tmpQuantity + ' > 0'; 

		dbconn.query(sqlStr, function(err, result){
			if(err) throw err;

		  	if (result.affectedRows > 0) {
				console.log('reduced from Product ' + result.affectedRows + ' rows');
		  	} else {
				var result = [
				  { message : 'Insufficient availability for ' + tmpSku,
				  details : null}
				];
				if (sendReply == false) {
					httpRes.json(result);
					sendReply = true;
				}

		  	}
		});

	}

	dbconn.end(function(err) {
	    console.log('Database connection is end');
	});

	return httpRes.send('');;
});

//classify method for adding demo
app.post('/product/classify/:sku', function(req, httpRes) {
	console.log( "Asked to classify " + req.params.sku );
	  httpRes.json('');
});



//delete based on sku #
app.delete('/product/products/:sku', function(req, httpRes) {

	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});
	dbconn.connect(function(err){
	  if(err){
	    console.log('Database connection error');
	  }else{
	    console.log('Database connection successful');
	  }
	});


	/* Begin transaction */
	dbconn.beginTransaction(function(err) {
	  	if (err) { throw err; }
	  	dbconn.query('DELETE FROM PRODUCT_KEYWORD where SKU = ?', req.params.sku, function(err, result){
	    		if (err) { 
	      			dbconn.rollback(function() {
				throw err;
	      			});
	    		}
		console.log('deleted from PRODUCT_KEYWORD ' + result.affectedRows + ' rows');
	 
		dbconn.query('DELETE FROM Product where SKU = ?', req.params.sku, function(err, result){
	      		if (err) { 
				dbconn.rollback(function() {
		  		throw err;
				});
	      		}  
			console.log('deleted from Product ' + result.affectedRows + ' rows');
		      	dbconn.commit(function(err) {
		      		if (err) { 
					dbconn.rollback(function() {
			  		throw err;
					});
		      		}  
				console.log('Transaction Complete.');
	  			httpRes.json('deleted from both Product and PRODUCT_KEYWORD tables in one transcation');
				dbconn.end(function(err) {
				    console.log('Database connection is end');
				});
		      	}); //end commit
	    	}); //end 2nd query
	  }); //end 1st query
	});
	/* End transaction */
});

//put (update) based on sku #
app.put('/product/products/:sku', function(req, res) {
	updateProduct(req.params.sku, req, res);
});

//patch (update) based on sku #
app.patch('/product/products/:sku', function(req, res) {
	updateProduct(req.params.sku, req, res);
});


//real update function works for both put and patch request
function updateProduct(skuIn, req, httpRes) {

	var dbconn = mysql.createConnection({
	  host     : dbHost,
	  user     : dbUser,
	  password : dbPassword,
	  database : dbDatabase
	});
	dbconn.connect(function(err){
	  if(err){
	    console.log('Database connection error');
	  }else{
	    console.log('Database connection successful');
	  }
	});

	var sqlStr0 = 'UPDATE Product SET '; 
	var sqlStr = ''; 
	if (req.body.DESCRIPTION != null){
		sqlStr = 'DESCRIPTION = \'' + req.body.DESCRIPTION + "\'";
	}
	if (req.body.HEIGHT != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'HEIGHT = \'' + req.body.HEIGHT + "\'";
	}
	if (req.body.LENGTH != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'LENGTH = \'' + req.body.LENGTH + "\'";
	}
	if (req.body.NAME != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'NAME = \'' + req.body.NAME + "\'";
	}
	if (req.body.WEIGHT != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'WEIGHT = \'' + req.body.WEIGHT + "\'";
	}
	if (req.body.WIDTH != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'WIDTH = \'' + req.body.WIDTH + "\'";
	}
	if (req.body.FEATURED != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'FEATURED = \'' + req.body.FEATURED + "\'";
	}
	if (req.body.AVAILABILITY != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'AVAILABILITY = \'' + req.body.AVAILABILITY + "\'";
	}
	if (req.body.IMAGE != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'IMAGE = \'' + req.body.IMAGE + "\'";
	}
	if (req.body.PRICE != null){
		if (sqlStr !='') sqlStr = sqlStr + " , ";
		sqlStr = sqlStr + 'PRICE = \'' + req.body.PRICE + "\'";
	}
	sqlStr = sqlStr0 + sqlStr + ' WHERE SKU = ?';
    	console.log('!!!!!SQL ready to be executed: ' + sqlStr);


	dbconn.query(sqlStr, skuIn, function(err, result){
	  if(err) throw err;
		console.log('update Product table' + result.affectedRows + ' rows');
	});

  	httpRes.json('Update Product table');

	dbconn.end(function(err) {
	    console.log('Database connection is end');
	});

}



app.listen(process.env.PORT || 8080);
