package com.fundhelper.session

import com.fundhelper.portfolio.YjbSession
import com.intellij.openapi.components.PersistentStateComponent
import com.intellij.openapi.components.Service
import com.intellij.openapi.components.State
import com.intellij.openapi.components.Storage
import com.intellij.util.xmlb.XmlSerializerUtil

@Service(Service.Level.APP)
@State(name = "FundHelperSession", storages = [Storage("fund-helper-session.xml")])
class SessionStorageService : PersistentStateComponent<SessionStorageService.State> {
    data class State(
        var token: String = "",
        var nickname: String = "",
        var avatar: String = "",
        var loginTime: String = "",
    )

    private var state = State()

    override fun getState(): State = state

    override fun loadState(state: State) {
        XmlSerializerUtil.copyBean(state, this.state)
    }

    fun load(): YjbSession? {
        if (state.token.isBlank()) return null
        return YjbSession(
            token = state.token,
            nickname = state.nickname,
            avatar = state.avatar,
            loginTime = state.loginTime,
        )
    }

    fun save(session: YjbSession) {
        state = State(
            token = session.token,
            nickname = session.nickname,
            avatar = session.avatar,
            loginTime = session.loginTime,
        )
    }

    fun clear() {
        state = State()
    }
}
