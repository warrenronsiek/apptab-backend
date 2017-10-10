Notes on configurations
=======================

AppTabCognito verification
--------------------------
In order to send verification messages the userpool needs an IAM role
and a checkmark in the box "Verify phone numbers" under the verification
tab in the userpool console. These attributes cannot be specified
in the cloudformation template.

In the ClientPools, under the verification tab, the email box must be checked.
Also, the message customization tab should indicate that verification emails with links
should be sent.

For any userpool that uses email-link verificaiton a domain also has to be registered. This can be done
under the App Integration -\> domain name tab.

Updating the backend
--------------------
It is very important to remember that DynamoDB can only create *or* delete one global secondary index per cloudformation update.
If you don't do this correctly, (e.g. editing one index = one create + one delete = 2 updates === a world of suffering) your update will fail and you will be stuck in a loop of undoing the things you built and redoing 
what you deleted. This can be a disaster as serverless wont necessarily update things when it doesn't detect changes.
Worst case scenario you have to delete everything and start over. 

Make sure that when you are changing GSIs in DynamoDB tables you make sequential changes and updates as you progress. 
E.g. if you want to change how a GSI works:
1. create a new GSI with the config you want
2. deploy
3. delete the old GSI
4. deploy

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