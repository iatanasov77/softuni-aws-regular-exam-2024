// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { S3Event } from 'aws-cdk-lib/aws-lambda';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';
import { v4 } from 'uuid';

const s3 = new S3Client( { region: process.env.AWS_REGION } );
const snsClient = new SNSClient( {} );
const dynamoDBClient = new DynamoDBClient( {} );

export const handler = async ( event: S3Event ) => {
    const tableName: string | undefined = process.env.TABLE_NAME;
    
    // Get the object from the event and show its content type
    const bucket = event.Records[0].s3.bucket.name;
    const key = decodeURIComponent( event.Records[0].s3.object.key.replace( /\+/g, ' ' ) );
    const params = {
        Bucket: bucket,
        Key: key,
    };
    
    try {
        const { ContentType, ContentLength, LastModified } = await s3.send( new HeadObjectCommand( params ) );
        console.log( 'CONTENT TYPE:', ContentType );
        
        const ttl: number = Math.floor( Date.now() / 1000 ) + 30 * 60; // 30 minutes
        
        await dynamoDBClient.send( new PutItemCommand({
            TableName: tableName,
            Item: {
                id: {
                    S: v4(),
                },
                TTL: {
                    N: ttl.toString(),
                },
                fileSize: {
                    N: ContentLength,
                },
                fileExtension: {
                    S: ContentType,
                },
                uploadedAt: {
                    N: LastModified,
                }
            }
        }));
    } catch ( err ) {
        console.log( err );
        const message = `Error getting object ${key} from bucket ${bucket}. Make sure they exist and your bucket is in the same region as this function.`;
        console.log( message );
        
        throw new Error( message );
    }
};
