package com.github.abri02.link.messaging.message

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class MentionParserTest {

    private val members = mapOf(1L to "alice", 2L to "bob", 3L to "carol.smith", 4L to "Dave")

    @Test
    fun `tokens finds every mention once in order`() {
        assertThat(MentionParser.tokens("@bob hi @alice, and @bob again"))
            .containsExactly("bob", "alice")
    }

    @Test
    fun `tokens ignores email addresses and a lone at sign`() {
        assertThat(MentionParser.tokens("mail bob@example.com or @ me")).isEmpty()
    }

    @Test
    fun `resolve maps known usernames to ids`() {
        assertThat(MentionParser.resolve("@alice and (@bob)", members)).containsExactly(1L, 2L)
    }

    @Test
    fun `resolve ignores unknown users`() {
        assertThat(MentionParser.resolve("@mallory @alice", members)).containsExactly(1L)
    }

    @Test
    fun `resolve returns duplicates once`() {
        assertThat(MentionParser.resolve("@bob @bob @bob", members)).containsExactly(2L)
    }

    @Test
    fun `resolve keeps dots inside a username but drops sentence punctuation`() {
        assertThat(MentionParser.resolve("ping @carol.smith.", members)).containsExactly(3L)
        assertThat(MentionParser.resolve("thanks @bob.", members)).containsExactly(2L)
    }

    @Test
    fun `resolve matches case-insensitively when there is no exact match`() {
        assertThat(MentionParser.resolve("@dave @ALICE", members)).containsExactly(4L, 1L)
    }

    @Test
    fun `resolve prefers the exact match when two names differ only by case`() {
        val clash = mapOf(1L to "sam", 2L to "Sam")
        assertThat(MentionParser.resolve("@Sam", clash)).containsExactly(2L)
        // Ambiguous without an exact match, so nobody is mentioned.
        assertThat(MentionParser.resolve("@SAM", clash)).isEmpty()
    }

    @Test
    fun `resolve returns nothing for a body without mentions`() {
        assertThat(MentionParser.resolve("hello everyone", members)).isEmpty()
    }
}
