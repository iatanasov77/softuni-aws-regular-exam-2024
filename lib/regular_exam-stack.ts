import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';

import {
    CfnKeyPair,
    IInstance,
    InstanceType,
    InstanceClass,
    InstanceSize,
    AmazonLinuxImage,
    AmazonLinuxGeneration
} from 'aws-cdk-lib/aws-ec2';

import { S3EventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { Bucket, EventType } from 'aws-cdk-lib/aws-s3';
import { Table } from 'aws-cdk-lib/aws-dynamodb';

import {
    db,
    storage,
    machine,
    application,
    BaseFunction,
    MachineKeyPair
} from 'aws-cdk-helpers';

export class RegularExamStack extends cdk.Stack
{
    cfnKeyPair: CfnKeyPair;
    
    webServer: IInstance;
    
    constructor( scope: Construct, id: string, props?: cdk.StackProps )
    {
        super( scope, id, props );
        
        const uploadBucket: Bucket = storage.createS3BucketForUpload( this, {
            namePrefix: 'My',
        });
        
        const s3UploadsTable: Table = db.createDynamoDbTable( this, { tableName: 'S3UploadsTable' } );
        
        const s3Handler: BaseFunction = new BaseFunction( this, 'S3Handler', {
            handlerFile: `${__dirname}/../src/lambda/s3_handler.ts`,
            handlerLocation: 's3_handler',
            tableName: s3UploadsTable.tableName
        });
//         s3Handler.addEventSource( new S3EventSource( uploadBucket, {
//             events: [
//                 EventType.OBJECT_CREATED_PUT,
//                 EventType.OBJECT_CREATED
//             ]
//         }));
        
        // Create Key Pair
        const keyPair: MachineKeyPair = machine.createKeyPair( this, { namePrefix: 'My' } );
        this.cfnKeyPair = keyPair.cfnKeyPair;
        
        // Create Web Server EC2 instance
        this.webServer = machine.createStandaloneWebServerInstance( this, {
            namePrefix: 'My',
            
            instanceType: InstanceType.of( InstanceClass.T2, InstanceSize.MICRO ),
            machineImage: new AmazonLinuxImage({
                generation: AmazonLinuxGeneration.AMAZON_LINUX_2023,
            }),
            
            keyPair: keyPair.keyPair,
            cidr: '10.0.0.0/21',
            
            uploadBucket: uploadBucket.bucketName,
            
            initElements: application.initSamplePhpApplication( this, {
                sourcePath: './src/web',
                applicationRoot: '/usr/share/nginx/html',
                files: [
                    'info.php',
                    'index.php'
                ],
                useComposer: true,
                withEnv: true,
                userName: 'iatanasov',
                envVars: new Map( [ ['AWS_S3_BUCKET', uploadBucket.bucketName] ] ),
            })
        });
        
        // Create Outputs
        this.createOutputs();
    }
    
    private createOutputs()
    {
        // Instance ID of the EC2 instance of the Web Server
        new cdk.CfnOutput( this, "InstanceId", {
            value: this.webServer.instanceId
        });
        
        // Download Private Key from KeyPair assigned to the EC2 instance of the Web Server
        new cdk.CfnOutput( this, 'DownloadKeyCommand', {
            value: `
aws ssm get-parameter --name /ec2/keypair/${this.cfnKeyPair.attrKeyPairId} \\
--with-decryption --query Parameter.Value \\
--output text --profile default > ~/cdk-key.pem && chmod 0600 ~/cdk-key.pem
`
        });
        
        // Connect to the Web Server with SSH
        new cdk.CfnOutput( this, 'ssh command', {
            value: `ssh -i ~/cdk-key.pem -o IdentitiesOnly=yes ec2-user@${this.webServer.instancePublicDnsName}`
        });
        
        // Web Interface Url
        new cdk.CfnOutput( this, "WebInterfaceUrl", {
            value: `http://${this.webServer.instancePublicIp}/`,
            description: 'Simple web interface to upload Files'
        });
    }
}
