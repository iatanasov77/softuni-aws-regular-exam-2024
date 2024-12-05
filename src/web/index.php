<?php
ini_set( 'display_errors', '1' );
ini_set( 'display_startup_errors', '1' );
error_reporting( E_ALL );

require 'vendor/autoload.php';

use Aws\S3\S3Client;
use Dotenv\Dotenv;

// Looing for .env at the root directory
$dotenv = Dotenv::createImmutable( __DIR__ );
$dotenv->load();

if ( isset( $_POST['submit'] ) ) {
    // File Extension
    $fileExtension = strtolower( pathinfo( $_FILES["aws-file-upload"]["name"], PATHINFO_EXTENSION ) );
    
    // Instantiate the client.
    $s3 = S3Client::factory([
        'credentials'   => [
            'key'       => $_ENV['AWS_ACCESS_KEY_ID'],
            'secret'    => $_ENV['AWS_ACCESS_KEY_SECRET'],
        ],
        "region"        => $_ENV['AWS_REGION'],
        "version"       => "latest"
    ]);
    
    try {
        // Upload a file.
        $result = $s3->putObject(array(
            'Bucket'        => $_ENV['AWS_S3_BUCKET'],
            'Key'           => uniqid(),
            'SourceFile'    => $_FILES["aws-file-upload"]["tmp_name"],
            'region'        => 'eu-central-1',
            'version'       => 'latest',
            'ContentType'   => $_FILES['aws-file-upload']['type'],
            'ACL'           => 'public-read',
            'StorageClass'  => 'REDUCED_REDUNDANCY',
            'Metadata'     => [
                'fileExtension' => $fileExtension,
            ]
        ));
        //echo $result['ObjectURL'];
    } catch ( \Exception $e) {
        echo "<pre>" . $e->getMessage();
        exit( 0 );
    }
    
    header( "Refresh:0" );
}

?>

<html lang="en">
    <head>
        <title>Upload Files</title>
        
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
    </head>
    <body>
        <form name="profile_form" method="post" enctype="multipart/form-data">
            <label for="aws-file-upload">Upload File</label>
            <input type="file" id="aws-file-upload" name="aws-file-upload" />
            <input type="submit" id="submit" name="submit" value="Upload a File" />
        </form>
    </body>
</html>
