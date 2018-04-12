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

Fixing Athena
-------------
When the data format piped into S3 changes this can cause a misalginment with athena's internal DDL on each athena partition.
So if one partition has a different data format than another one, queries will get all sorts of crazy errors. E.g. you 
change the redux state structure of the app, this will change the data format sent into firehose, which changes the data piped into 
s3, which changes Athena's DDL for the new data. This can be fixed by deleting all partitions on the table, running 
`MSCK REPAIR TABLE <tablename>`, and then re-running the crawler. This is accomplished on all tables at once by running
the `clean_athena.py` script. 

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
2. delete the contents of the relevent  in 
3. delete the iam roles associated with the phone verification in the userpools. You can see these under the 
verifications tab of the userpool in the console.
4. delete the contents of `{stage}-apptab-athena-queries`, `{stage}-apptab-formatted-data-bucket`, `{stage}-apptab-data-bucket`, `{stage}-apptab-image-bucket` in s3 (otherwise delete will fail).
5. delete the domain from the cognito userpool.
6. run `sls remove` for apptab-backend
7. run `sls deploy` in the following order:
    1. apptab-backend
    2. apptab-customer-api, apptab-client-api, apptab-web-api
8. go into the cognito console and adjust the userpools as described above in this document.
9. go into the `/app/vars.js` file in the AppTabCustomerApp and replace identitypoolids/lambda urls generated
by steps 1 and 2. 
10. generate a credentials set associated with the testing users for the serverless projects and put them in the relevant
`/test/common/{stage}TesterCredentials.json` files. 
11. get the facebook app id and secret
    1. put them into the cognito userpool under the tab "identity providers". 
    2. Put 'email' and 'public_profile' under authorizaiton scopes. 
    3. Click enable.
12. use the same facebook credentials and enable them inside of the federated identity pool.
13. follow steps [here](https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-social.html) to enable facebook login.
14. create cognito userpool domain in the console under domains tab 
15. login to facebook developer and click on facebook login > Settings
    1. add the userpool domain url to 'valid oauth redirect uris' (e.g. https://apptabdevuserpool.auth.us-west-2.amazoncognito.com/oath2/idpresponse make sure to add the /oath2/idpresponse bit.)
16. In the cognito userpool go to App Integration > App Client Settings
    1. Add "apptab://login" to the callback/signout urls 
    2. enable facebook (still under App Client Settings) 
    3. check the boxes 'Authorization Code Grant' and add 'phone', 'email', 'openid', 'profile' under allowed oauth scopes.
    4. save
    5. take the 'ID' off of this page and update the login url in the app vars.js. it should look like:
    `https://<domain name>.auth.us-west-2.amazoncognito.com/login?response_type=code&client_id=[ID]&redirect_uri=apptab://login`