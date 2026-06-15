plugins {
    id("java")
    id("org.jetbrains.kotlin.jvm") version "2.3.0"
    id("org.jetbrains.intellij.platform") version "2.5.0"
}

group = "com.fundhelper"
version = "0.1.0"

repositories {
    mavenCentral()
    intellijPlatform {
        defaultRepositories()
    }
}

dependencies {
    intellijPlatform {
        val localIdePath = "/Applications/WebStorm.app"
        if (System.getenv("CI") == null && file(localIdePath).exists()) {
            local(localIdePath)
        } else {
            // CI / 无本地 IDE 时从仓库拉取，供 buildPlugin 与 runIde 使用
            intellijIdeaCommunity("2024.2.6")
        }
    }
    implementation("com.google.code.gson:gson:2.11.0")
}

kotlin {
    jvmToolchain(17)
}

intellijPlatform {
    buildSearchableOptions = false
    pluginConfiguration {
        name = "Fund Helper"
        version = project.version.toString()
        ideaVersion {
            sinceBuild = "242"
            untilBuild = "261.*"
        }
    }
}

tasks {
    runIde {
        jvmArgs("-Xmx2048m")
    }
    processResources {
        dependsOn("buildWebview")
    }
    register<Exec>("buildWebview") {
        group = "build"
        description = "Build React webview assets into src/main/resources/webview"
        workingDir = projectDir
        commandLine("pnpm", "run", "build:webview")
        inputs.dir("webview/src")
        inputs.file("vite.webview.config.ts")
        inputs.file("package.json")
        outputs.dir("src/main/resources/webview")
        isIgnoreExitValue = false
    }

    buildPlugin {
        dependsOn("buildWebview")
    }
}
