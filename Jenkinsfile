def stageOrder = ['Checkout', 'Test', 'Build Images', 'Deploy', 'Smoke Test']
def currentStageName = 'Checkout'

pipeline {
    agent any

    environment {
        DISCORD_WEBHOOK_URL = credentials('discord-webhook-url')
        CI_DISCORD_WEBHOOK_URL = credentials('ci-discord-webhook-url')
        DB_NAME = 'student_org'
        DB_USER = 'student_org'
        DB_PASSWORD = credentials('db-password')
        ADMIN_PASSWORD = credentials('admin-password')
        IMAGE_TAG = "${env.BUILD_NUMBER}"
        COMPOSE_PROJECT_NAME = 'eventify'
    }

    stages {

        stage('Checkout') {
            steps {
                script { currentStageName = 'Checkout' }
                checkout scm
            }
        }

        stage('Test') {
            steps {
                script { currentStageName = 'Test' }
                dir('event-api') {
                    sh 'npm ci'
                    sh 'npm test'
                }
                dir('registration-api') {
                    sh 'npm ci'
                    sh 'npm test'
                }
            }
        }

        stage('Build Images') {
            steps {
                script { currentStageName = 'Build Images' }
                sh "docker build -t event-api:${IMAGE_TAG} ./event-api"
                sh "docker build -t registration-api:${IMAGE_TAG} ./registration-api"
                sh "docker build -t frontend:${IMAGE_TAG} ./frontend"
                sh "docker build -t proxy:${IMAGE_TAG} ./proxy"

                sh "docker tag event-api:${IMAGE_TAG} event-api:latest"
                sh "docker tag registration-api:${IMAGE_TAG} registration-api:latest"
                sh "docker tag frontend:${IMAGE_TAG} frontend:latest"
                sh "docker tag proxy:${IMAGE_TAG} proxy:latest"
            }
        }

        stage('Deploy') {
            steps {
                script { currentStageName = 'Deploy' }
                sh 'docker compose up -d'
            }
        }

        stage('Smoke Test') {
            steps {
                script { currentStageName = 'Smoke Test' }
                sh 'sleep 10'
                sh 'curl -f http://proxy/ || exit 1'
                sh 'curl -f http://event-api:3000/health || exit 1'
                sh 'curl -f http://registration-api:3001/health || exit 1'
            }
        }
    }

        post {
        always {
            script {
                def failedIndex = stageOrder.indexOf(currentStageName)
                def isSuccess = currentBuild.currentResult == 'SUCCESS'

                def stageLines = []
                for (int i = 0; i < stageOrder.size(); i++) {
                    def name = stageOrder[i]
                    if (isSuccess || i < failedIndex) {
                        stageLines.add("✅ ${name}")
                    } else if (i == failedIndex) {
                        stageLines.add("❌ ${name}")
                    } else {
                        stageLines.add("⏭️ ${name} (skipped)")
                    }
                }
                def stageLinesStr = stageLines.join('\n')

                def commitMsg = sh(script: "git log -1 --pretty=%s", returnStdout: true).trim()
                def commitAuthor = sh(script: "git log -1 --pretty=%an", returnStdout: true).trim()
                def shortSha = sh(script: "git rev-parse --short HEAD", returnStdout: true).trim()
                def branch = env.GIT_BRANCH ?: 'unknown'

                def title = isSuccess
                    ? "✅ Eventify Build #${env.BUILD_NUMBER} succeeded"
                    : "❌ Eventify Build #${env.BUILD_NUMBER} failed at ${currentStageName}"

                def payload = [
                    embeds: [[
                        title: title,
                        color: isSuccess ? 3066993 : 15158332,
                        fields: [
                            [name: 'Branch', value: branch, inline: true],
                            [name: 'Commit', value: "${shortSha} by ${commitAuthor}", inline: true],
                            [name: 'Duration', value: currentBuild.durationString.replace(' and counting', ''), inline: true],
                            [name: 'Message', value: commitMsg, inline: false],
                            [name: 'Stages', value: stageLinesStr, inline: false],
                        ],
                        url: env.BUILD_URL,
                    ]]
                ]

                writeFile file: 'discord_payload.json', text: groovy.json.JsonOutput.toJson(payload)

                sh '''
                    curl -s -H "Content-Type: application/json" \
                    -d @discord_payload.json \
                    "$CI_DISCORD_WEBHOOK_URL"
                '''
            }
        }
    }git add Jenkinsfile
}