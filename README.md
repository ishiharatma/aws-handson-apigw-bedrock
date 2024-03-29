# Amazon Bedrock を利用した画像生成アプリケーション

![title](/docs/images/title.png)

参考にした記事はこちらです。

[Amazon Bedrock を利用して、画像生成アプリケーションを開発してみた！ |builders.flash](https://aws.amazon.com/jp/builders-flash/202402/bedrock-image-generation/?awsf.filter-name=*all)

![overview](/docs/images/flash-2402-bedrock01.b09cca5d2fa421e37b345ea7a71bd6003032851b.png)

こちらの記事の内容を AWS CDK で実装したものになります。
手順の「3-2. S3 バケットの作成～3-4. Amazon API Gateway で API を作成」までを実装しています。

## 前提条件

1. Amazon Bedrock で、画像生成用の基盤モデルを利用可能にしておきます。
   - 「3-1. Amazon Bedrock で、画像生成用の基盤モデルを利用可能にする」を実施します。
2. `.aws\credentials` に次の定義を作成します。CDK実行時のプロファイル名 `<プロジェクト名>-<環境識別子>` に使用します。
   <プロジェクト名>と<環境識別子>はCDK実行時に指定するパラメータ（project, env）に紐づきます。

   ```text
    [<プロジェクト名>-<環境識別子>-accesskey]
    # 初期設定用
    aws_access_key_id  = XXXXXX
    aws_secret_access_key = ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ
    [<プロジェクト名>-<環境識別子>]
    region = ap-northeast-1
    role_arn = arn:aws:iam::<AWSアカウントID>:role/<スイッチロール名>
    mfa_serial = arn:aws:iam::<AWSアカウントID>:mfa/<MFAデバイス名>
    source_profile = <プロジェクト名>-<環境識別子>-accesskey
   ```

## デプロイ方法

```sh
npm run cdk:deploy:all --project=sample --env=prod --myip=0.0.0.0/0
or
# APIGateway へのアクセスIPを制限したい場合
npm run cdk:deploy:all --project=sample --env=prod --myip=x.x.x.x/32
```

![deploy](/docs/images/deploy.png)

![deploy_done](/docs/images/deploy_done.png)

## 動作確認

```sh
## API実行
curl -X POST {作成した API のエンドポイント}/bedrock -H 'Content-Type: application/json' -d '{"input_text":"an image of cat"}'

## API実行(for Windows)
curl -X POST {作成した API のエンドポイント}/v1/bedrock -H "Content-Type: application/json" -d "{\"input_text\":\"an image of cat\"}" 

## レスポンス
{"presigned_url": "https://s3.amazonaws.com/xxxxxx"}

## ダウンロード
curl -O "{レスポンスの署名付きURL}"
```

### 指示内容について

実行例にある、下記指示を行った場合の画像は次のようになります。

```json
{"input_text":"an image of cat"}
```

![image1](/docs/images/5c2bc404e3ab48bf86629667f5d10a79.png)

絵画のような画像なので、少し指示を増やしてリアルな画像を生成してみます

```json
{"input_text":"an image of cat with a photo-realistic."}
```

![image2](/docs/images/fca7ae7e7b6b4bbd95fbbe84a62082ee.png)

## 後片付け

```sh
npm run cdk:destroy:all --project=sample --env=prod
```

![destroy](/docs/images/destroy.png)

CloudWatch ロググループなどが残っている場合がありますので削除してください。

以上
