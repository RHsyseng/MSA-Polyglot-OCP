require 'bundler/setup'
require 'json'
require_relative 'lib/result'
require_relative 'lib/transcation'

Bundler.require(:default)

class Application < Sinatra::Base


before do
	content_type 'application/json'
end

post '/billing/refund/:id' do
	"refund for transcation number #{params[:id]}"
end

get '/billing/process' do
  	"please use post method on url/process to handle credit card transaction"
end

post '/billing/process' do
  	post_data =  JSON.parse request.body.read
  	if post_data.nil? or !post_data.has_key?('creditCardNumber')  or !post_data.has_key?('verificationCode')
   		puts "ERROR, no credit Card Number2 or verificatoin Code !"
	else
	   	transcation = Transcation.new 
		transcation.creditCardNumber = post_data['creditCardNumber']
		transcation.expMonth = post_data['expMonth']
		transcation.expYear = post_data['expYear']
		transcation.verificationCode = post_data['verificationCode']
		transcation.billingAddress = post_data['billingAddress']
		transcation.customerName = post_data['customerName']
		transcation.orderNumber = post_data['orderNumber']
		transcation.amount = post_data['amount']

		puts "creditCardNumber  #{transcation.creditCardNumber}"
		puts "expMonth          #{transcation.expMonth}"
		puts "expYear           #{transcation.expYear}"
		puts "billingAddress    #{transcation.billingAddress}"
		puts "customerName      #{transcation.customerName}"
		puts "orderNumber       #{transcation.orderNumber}"
		puts "amount            #{transcation.amount}"

		result = Result.new
		result.name = transcation.customerName
		result.orderNumber = transcation.orderNumber
		result.transactionDate = DateTime.now
		result.transactionNumber = 9000000 + rand(1000000)

		if transcation.expYear.to_i < Time.now.year.to_i or (transcation.expYear.to_i == Time.now.year.to_i and transcation.expMonth.to_i <= Time.now.month.to_i)
			result.status = "FAILURE"
		else
			result.status = "SUCCESS"
		end

		result.to_json
  	end
end




end

run Application
