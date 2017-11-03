#!/usr/local/bin/python3.6
import boto3
import sys

database = sys.argv[1]
print(database)
glue = boto3.client('glue')
athena = boto3.client('athena')

res = glue.get_tables(DatabaseName=database)
tables = []
for table in res['TableList']:
    tables.append(table['Name'])

for table in tables:
    res = glue.get_partitions(DatabaseName=database, TableName=table)
    partition_vals = []
    for partition in res['Partitions']:
        partition_vals.append(partition['Values'])
    for val in partition_vals:
        print('deleting partition {1} in table {0}'.format(table, val))
        glue.delete_partition(DatabaseName=database, TableName=table, PartitionValues=val)

    print('executing repair query on {0}'.format(table))
    athena.start_query_execution(QueryString='MSCK REPAIR TABLE {0};'.format(table),
                                 QueryExecutionContext={'Database': database},
                                 ResultConfiguration={
                                     'OutputLocation': 's3://warren.misc.files'
                                 })
print('re-running crawler')
glue.start_crawler(Name='{0}crawler'.format(database))
