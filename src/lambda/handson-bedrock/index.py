# 必要なライブラリを読み込み
import os
import json
import boto3
import base64
import uuid
from botocore.config import Config
from logging import getLogger, INFO

logger = getLogger()
logger.setLevel(INFO)

bedrock_runtime = boto3.client('bedrock-runtime')
# 署名プロセスには、署名バージョン4(SigV4)を指定
my_config = Config(region_name="us-east-1", signature_version="s3v4")
s3 = boto3.client("s3", config=my_config)
#bucket_name = '作成したS3バケット名'

def lambda_handler(event, context):
    try:
        logger.info('start')
        logger.info('event: {}'.format(event))
        logLevel = os.environ.get('LOG_LEVEL', 'INFO')
        logger.setLevel(logLevel)

        # 作成したS3バケット名を環境変数から取得
        bucket_name = os.environ.get('S3_BUCKET_NAME')
        if bucket_name is None:
           raise Exception('S3 bucket name was not specified.')

        # S3に保存するためのランダムなオブジェクト名を生成
        random_uuid = uuid.uuid4().hex 
        # 入力を受け取る
        body = json.loads(event['body'])
        input_text = body.get('input_text')
        
        # Amazon Bedrockで用意した基盤モデルへAPIリクエストし、画像を生成する
        response = bedrock_runtime.invoke_model(
            body='{"text_prompts": [{"text":"'+input_text+'"}]}',
            contentType='application/json',
            accept='image/png',
            modelId='stability.stable-diffusion-xl-v1'
        )
        
        s3_key = random_uuid + '.png'
        
        # 生成された画像をS3にアップロード    
        s3.upload_fileobj(response['body'], bucket_name, s3_key, ExtraArgs={'ContentType': 'image/png'})
        # 署名付きURLを取得
        presigned_url = s3.generate_presigned_url('get_object',Params={'Bucket': bucket_name,'Key': s3_key},ExpiresIn=3600) 
        
        # 署名付きURLを返す
        return {
            'statusCode': 200,
            'body': json.dumps({'presigned_url': presigned_url})
        }
    except Exception as e:
      logger.exception(str(e))
      return {
            'statusCode': 500,
            'body': json.dumps(str(e))
      }
    finally:
      logger.info('complete.')