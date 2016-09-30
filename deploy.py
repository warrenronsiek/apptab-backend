import boto3
import sys
import os

cwd = os.getcwd()
cloud_formation = boto3.client('cloudformation')
s3 = boto3.client('s3')
s3_bucket_url = "https://s3-us-west-1.amazonaws.com/cloud.formation.files/"
s3_bucket = "cloud.formation.files"
file_path, file_name = os.path.split(sys.argv[1])
stack_name = file_name.split('.')[0]
fully_qualified_file_name = sys.argv[1]

s3.upload_file(fully_qualified_file_name, s3_bucket, file_name)
cloud_formation.validate_template(TemplateURL=s3_bucket_url + file_name)

if sys.argv[2] == 'delete':
    cloud_formation.delete_stack(StackName=stack_name)
elif sys.argv[2] == 'update':
    cloud_formation.update_stack(StackName=stack_name, TemplateURL=s3_bucket_url + file_name)
elif sys.argv[2] == 'create':
    cloud_formation.create_stack(StackName=stack_name, TemplateURL=s3_bucket_url + file_name)
else:
    print "argument not recognized"
