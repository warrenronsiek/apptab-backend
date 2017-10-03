Notes on configurations
=======================

AppTabCognito phone verification
--------------------------------
In order to send verification messages the userpool needs an IAM role
and a checkmark in the box "Verify phone numbers" under the verification
tab in the userpool console. These attributes cannot be specified
in the cloudformation template.

Updating the backend
--------------------
It is very important to remember that DynamoDB can only create or delete one global secondary index per cloudformation update.
If you don't do this correctly, your update will fail and you will be stuck in a loop of undoing the things you built and redoing 
what you deleted. This can be a disaster as serverless wont necessarily update things when it doesn't detect changes.
Worst case scenario you have to delete everything and start over. 

Make sure that when you are changing GSIs in DynamoDB tables you make sequential changes and updates as you progress. 

So you want to restart the world
--------------------------------
1. run `sls remove` for apptab-web, apptab-client-api, and apptab-customer-api
2. delete the contents of the relevent `{stage}-apptab-data-bucket` in s3 (otherwise delete will fail)
3. delete the iam roles associated with the phone verification in the userpools. You can see these under the 
verifications tab of the userpool in the console.
2. run `sls remove` for apptab-backend
3. run `sls deploy` in the following order:
    1. apptab-backend
    2. apptab-customer-api, apptab-client-api, apptab-web-api
4. go into the cognito console and adjust the userpools as described above in this document.
5. go into the `/app/vars.js` file in the AppTabCustomerApp and replace identitypoolids/lambda urls generated
by steps 1 and 2. 
6. generate a credentials set associated with the testing users for the serverless projects and put them in the relevant
`/test/common/{stage}TesterCredentials.json` files. 