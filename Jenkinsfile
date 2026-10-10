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
                checkout scm
            }
        }

        stage('Test') {
            steps {
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
                sh 'docker compose up -d'
            }
        }

        stage('Smoke Test') {
            steps {
                sh 'sleep 10'
                sh 'curl -f http://proxy/ || exit 1'
                sh 'curl -f http://event-api:3000/health || exit 1'
                sh 'curl -f http://registration-api:3001/health || exit 1'
            }
        }
    }

    post {
        success {
            sh """
                curl -s -H "Content-Type: application/json" \
                -d '{"content": "✅ **Eventify Build #${IMAGE_TAG} succeeded** — deployed and verified.\\n${env.BUILD_URL}"}' \
                "${CI_DISCORD_WEBHOOK_URL}"
            """
            echo "Build ${IMAGE_TAG} deployed and verified successfully."
        }
        failure {
            sh """
                curl -s -H "Content-Type: application/json" \
                -d '{"content": "❌ **Eventify Build #${IMAGE_TAG} failed** — deployment was NOT updated.\\n${env.BUILD_URL}"}' \
                "${CI_DISCORD_WEBHOOK_URL}"
            """
            echo "Build ${IMAGE_TAG} failed — deployment was NOT updated."
        }
    }
}