const express = require('express');
const app     = express();
const bodyParser = require('body-parser');

app.use(bodyParser.json());


const dbUser = process.env.MYSQL_USER;
const dbPassword = process.env.MYSQL_PASSWORD;

var dbHost = process.env.MYSQL_HOST;
var dbDatabase = process.env.MYSQL_DATABASE;

if (dbHost == null) dbHost = 'product-db';
if (dbDatabase == null) dbDatabase = 'product';

console.log('!!!!!!!!!!!!!!!!!!!!!!dbUser ' + dbUser);
console.log('!!!!!!!!!!!!!!!!!!!!!!dbPassword ' + dbPassword);
console.log('!!!!!!!!!!!!!!!!!!!!!!dbDatabase ' + dbDatabase);
console.log('!!!!!!!!!!!!!!!!!!!!!!dbHost ' + dbHost);

const mysql  = require('mysql');
const pool = mysql.createPool({
  connectionLimit : 5,
  host            : dbHost,
  user            : dbUser,
  password        : dbPassword,
  database        : dbDatabase
});


//get either featured products or products with keyword
app.get('/product/products', function(req, httpRes) {
	if(req.query.featured == null && req.query.keyword == null) {
		httpRes.statusCode = 400;
		return httpRes.send('All products cannot be returned, need to provide a search condition');
	}


	pool.getConnection(function(err, conn) {
		if (req.query.featured != null) {
			conn.query('select sku, availability, description, featured=1 as featured, height, image, length, name, price, weight, width from Product where featured=true', function(err, records) {
				if(err) throw err;
				httpRes.json(records);
			});
		} else if (req.query.keyword != null){
			conn.query('select sku, availability, description, featured=1 as featured, height, image, length, name, price, weight, width from Product where SKU in (select SKU from PRODUCT_KEYWORD where Keyword = ?)', req.query.keyword, function(err, records) {
				if(err) throw err;
				httpRes.json(records);
			});

		} 
	    	conn.release();
	});
});


//get based on sku #
app.get('/product/products/:sku', function(req, httpRes) {
	pool.getConnection(function(err, conn) {
		conn.query('select sku, availability, description, featured=1 as featured, height, image, length, name, price, weight, width from Product where SKU = ? ', req.params.sku, function(err, records) {
			if(err) throw err;
			httpRes.json(records[0]);
		});
	    	conn.release();
	});
});


//add keyword through post 
app.post('/product/keywords', function(req, httpRes) {
	const record= { KEYWORD: req.body.keyword};
	pool.getConnection(function(err, conn) {
		conn.query('INSERT INTO Keyword SET ?', record, function(err, records) {
			if(err) throw err;
			const result = {
				keyword : req.body.keyword,
  				products : null}
	  		httpRes.json(result);
		});
	    	conn.release();
	});

});


//add product through post 
app.post('/product/products', function(req, httpRes) {
	//To use "let" need strict mode in node version 4.*
	"use strict";
	pool.getConnection(function(err, dbconn) {

		// Begin transaction
		dbconn.beginTransaction(function(err) {
		  	if (err) { throw err; }

			let featured = 0;
			if (req.body.featured = 'true') 
				featured = 1;

			let record= { DESCRIPTION: req.body.description, HEIGHT: req.body.height, LENGTH: req.body.length,  NAME: req.body.name, WEIGHT: req.body.weight, WIDTH: req.body.width, FEATURED: featured, 	AVAILABILITY: req.body.availability, IMAGE: req.body.image, PRICE: req.body.price};

			dbconn.query('INSERT INTO Product SET ?', record, function(err,dbRes){
		    		if (err) { 
		      			dbconn.rollback(function() {
					throw err;
		      			});
		    		}

				const tmpSku = dbRes.insertId;
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

					const result = {
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

			      		}); //end commit
		    		}); //end 2nd query
		  	}); //end 1st query
		});
		// End transaction

	    	dbconn.release();
	});//end pool.getConnection
});

//reduce product through post, this is for the checkout process 
app.post('/product/reduce', function(req, httpRes) {
	"use strict";
	let sendReply = false;
	
	pool.getConnection(function(err, conn) {
		for (let i = 0; i < req.body.length; i++) {
			if(!req.body[i].hasOwnProperty('sku') || !req.body[i].hasOwnProperty('quantity')) {
				httpRes.statusCode = 400;
				return httpRes.send('Error 400: need to have valid sku and quantity.');
			}

			const tmpSku = req.body[i]['sku'];
			const tmpQuantity = req.body[i]['quantity'];
			const sqlStr = 'update Product set availability = availability - ' + tmpQuantity + ' where sku = ' + tmpSku + ' and availability - ' + tmpQuantity + ' > 0'; 
			console.log('reduce tmpSku:' + tmpSku);
			console.log('reduce tmpQuantity:' + tmpQuantity);
			console.log('reduce sqlStr: ' + sqlStr);

			conn.query(sqlStr, function(err, result) {
				if(err) throw err;

			  	if (result.affectedRows > 0) {
					console.log('reduced from Product ' + result.affectedRows + ' rows');
			  	} else {
					const result = [
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
    		conn.release();
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

	pool.getConnection(function(err, dbconn) {

		// Begin transaction
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

			      	}); //end commit
		    	}); //end 2nd query
		  }); //end 1st query
		});
		// End transaction

	    	dbconn.release();
	});//end pool.getConnection
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
	"use strict";
	let sqlStr = ''; 
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
	sqlStr = 'UPDATE Product SET ' + sqlStr + ' WHERE SKU = ?';
    	console.log('!!!!!SQL ready to be executed: ' + sqlStr);


	pool.getConnection(function(err, conn) {
		conn.query(sqlStr, skuIn, function(err, result) {
			if(err) throw err;
			console.log('update Product table' + result.affectedRows + ' rows');
		});
	    	conn.release();
	});

  	httpRes.json('Update Product table');
}

//close connection pool when detected ctrl-c command
process.on('SIGINT', function() {
    	console.log("Caught interrupt signal");

    	pool.end(function (err) {
	    	console.log("Closed connection pool");
	        process.exit();
	});

});


app.listen(process.env.PORT || 8080);



