package com.github.abri02.link.messaging.message

/**
 * Finds `@username` mentions in a message body. A mention starts at the beginning of the text or
 * after a character that can't be part of a word (so `mail@bob.com` is not a mention).
 */
object MentionParser {

    private val TOKEN = Regex("""(?<![\p{L}\p{N}_@.\-])@([\p{L}\p{N}_.\-]+)""")

    /** The raw names after each `@`, in order of appearance, without duplicates. */
    fun tokens(body: String): Set<String> =
        TOKEN.findAll(body).map { it.groupValues[1] }.toCollection(LinkedHashSet())

    /**
     * Resolves the mentions in [body] to user ids using [usernames] (user id → username). An exact
     * match wins. Otherwise trailing sentence punctuation is dropped (`@bob.`) and the name is
     * matched case-insensitively. Unknown names are ignored.
     */
    fun resolve(body: String, usernames: Map<Long, String>): Set<Long> {
        val tokens = tokens(body)
        if (tokens.isEmpty() || usernames.isEmpty()) return emptySet()

        val exact = usernames.entries.associate { (id, name) -> name to id }
        val lower = usernames.entries.groupBy({ it.value.lowercase() }, { it.key })
            .filterValues { it.size == 1 }
            .mapValues { it.value.single() }

        return tokens.mapNotNullTo(LinkedHashSet()) { token ->
            val trimmed = token.trimEnd('.', '-')
            exact[token] ?: exact[trimmed] ?: lower[token.lowercase()] ?: lower[trimmed.lowercase()]
        }
    }
}
