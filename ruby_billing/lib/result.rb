class Result  

  attr_accessor :status, :name, :orderNumber, :transactionDate, :transactionNumber

def to_json(*a)
  {
    	'status'   => @status,
    	'name'         => @name, 
	'orderNumber' => @orderNumber, 
	'transactionDate' => @transactionDate, 
	'transactionNumber' => @transactionNumber
  }.to_json(*a)
end
    
end
